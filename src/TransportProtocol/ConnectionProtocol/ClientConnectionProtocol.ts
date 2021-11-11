import TypedEmitter from 'typed-emitter';
import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import pDefer from 'p-defer';
import { Transform } from 'stream';
import { BinaryDataDecoder, BinaryDataEncoder } from '../../BinaryDataEncoding';
import { Message, MessageType } from './Message';
import { UInt32 } from '../../DataTypes/Primitives';
import { ClientTcpTransport } from '../ClientTcpTransport';
import { ClientTransportProtocol, ClientTransportProtocolEvents } from '../types';
import { ClientWssTransport } from '../ClientWssTransport';
import { HelloMessageBody } from './HelloMessageBody';
import { AcknowledgeMessageBody } from './AcknowledgeMessageBody';
import { OpenState } from '../../types';
import { ErrorMessageBody } from './ErrorMessageBody';
import { UaError } from '../../UaError';
import { StatusCode } from '../../DataTypes/StatusCode';

export interface ClientConnectionProtocolOptions {
  endpointUrl: string;
  openTimeout: number;
}

export class ClientConnectionProtocol extends (EventEmitter as new () => TypedEmitter<ClientTransportProtocolEvents>) implements ClientTransportProtocol, ClientConnectionProtocolOptions {
  get endpointUrl(): string { return this.#endpointUrl; }
  #endpointUrl: string;
  get openTimeout(): number { return this.#transportProtocol.openTimeout; }
  set openTimeout(value: number) { this.#transportProtocol.openTimeout = value; }

  get bufferSize(): UInt32 { return this.#bufferSize ?? 8192; }
  #bufferSize?: UInt32;
  get maxMessageSize(): UInt32 { return this.#maxMessageSize ?? 0; }
  #maxMessageSize?: UInt32;
  get maxChunkCount(): UInt32 { return this.#maxChunkCount ?? 0; }
  #maxChunkCount?: UInt32;

  get state(): OpenState{ return this.#state; }
  #state = OpenState.Closed;
  
  #transportProtocol: ClientTransportProtocol & TypedEmitter<ClientTransportProtocolEvents>;

  #openQueue = new PQueue({concurrency: 1});
  #writeQueue = new PQueue({concurrency: 1});
  #openResponse?: pDefer.DeferredPromise<AcknowledgeMessageBody>;
  #dataStream = new Transform();

  constructor(options: ClientConnectionProtocolOptions) {
    super();
    this.#endpointUrl = options.endpointUrl;

    let url = new URL(this.endpointUrl);

    // Workaround chrome/electron broken url parsing.
    const protocol = url.protocol;
    url = new URL(url.toString().replace(`${protocol}//`, 'http://'));
    const href = url.toString().replace('http://', `${protocol}//`);

    switch (protocol) {
      case 'opc.tcp:': {
        this.#transportProtocol = new ClientTcpTransport({
          host: url.hostname,
          port: url.port ? parseInt(url.port) : 4840,
          openTimeout: options.openTimeout
        });
        break;
      }
      case 'ws:':
      case 'wss:':
      case 'opc.ws:':
      case 'opc.wss:': {
        this.#transportProtocol = new ClientWssTransport({
          url: href.replace(/^opc\./, ''),
          openTimeout: options.openTimeout
        });
        break;
      }
      default: {
        throw new UaError({code: StatusCode.BadNotSupported, reason: 'Unknown protocol'});
      }
    }

    this.#transportProtocol.on('close', this.#onClose);
    this.#transportProtocol.on('error', this.#onClose);
    this.#transportProtocol.on('message', this.#onMessage);
  }

  async open(): Promise<void> {
    return this.#openQueue.add(async () => {
      try {
        if (this.#state === OpenState.Open) {
          return;
        }
  
        this.#state = OpenState.Opening;
  
        await this.#transportProtocol.open();

        const messageBody = new HelloMessageBody({
          protocolVersion: 0,
          receiveBufferSize: 0xFFFF_FFFF,
          sendBufferSize: 0xFFFF_FFFF,
          maxMessageSize: 0,
          maxChunkCount: 0,
          endpointUrl: this.endpointUrl
        });
  
        const message = new Message({
          messageType: MessageType.HEL,
          body: messageBody
        });

        const deferredResponse = this.#openResponse = pDefer<AcknowledgeMessageBody>();
  
        setTimeout(() => {
          const write = async (): Promise<void> => {
            try {
              await this.write(BinaryDataEncoder.encodeType(message));
            } catch (e) {
              deferredResponse.reject(e);
            }
          };
          void(write());
        });
  
        const timeout = setTimeout(() => {
          deferredResponse.reject(new UaError({code: StatusCode.BadTimeout}));
        }, this.openTimeout);
  
        try {
          const response = await deferredResponse.promise;
          this.#bufferSize = response.receiveBufferSize;
          this.#maxMessageSize = response.maxMessageSize;
          this.#maxChunkCount = response.maxChunkCount;
          this.#state = OpenState.Open;
        } finally {
          clearTimeout(timeout);
          this.#openResponse = undefined;
        }
      } catch (e) {
        this.#state = OpenState.Closed;
        this.#transportProtocol.close(e as UaError);
        throw e;
      }
    });
  }

  write(data: Uint8Array): Promise<void> {
    return this.#writeQueue.add(async () => {
      await this.#transportProtocol.write(data);
    });
  }
 
  #onMessage = (_data: Uint8Array): void => {
    this.#dataStream.push(_data);

    const msData = this.#dataStream.read(8) as Buffer | null;
    if (!msData) {
      return;
    }
    const messageSize = msData.readUInt32LE(4);
    this.#dataStream.unshift(msData);

    const dataBuf = this.#dataStream.read(messageSize) as Buffer | null;

    if (!dataBuf) {
      return;
    }

    const data = new Uint8Array(dataBuf.buffer, dataBuf.byteOffset, dataBuf.byteLength);
    let hadError = false;
    
    try {
      const decoder = new BinaryDataDecoder(data);
      const messageType = decoder.readFixedLengthString(3) as MessageType;

      if (!MessageType[messageType]) {
        this.emit('message', data);
        return;
      }
      
      const message = BinaryDataDecoder.decodeType(data, Message);
      switch (message.messageType) {
        case MessageType.ACK: {
          this.#openResponse?.resolve(message.body as AcknowledgeMessageBody);
          break;
        }
        case MessageType.ERR: {
          const errMessage = message.body as ErrorMessageBody;
          this.#transportProtocol.close(new UaError({
            code: errMessage.error,
            reason: errMessage.reason
          }));
          break;
        }
        case MessageType.HEL: {
          throw new UaError({code: StatusCode.BadUnexpectedError, reason: 'Unexpected HelloMessage'});
        }
        case MessageType.RHE: {
          // Ignore
          break;
        }
      }
    } catch (e) {
      hadError = true;
      this.#transportProtocol.close(e as UaError);
    } finally {
      if (!hadError) {
        this.#dataStream.readableLength && this.#onMessage(new Uint8Array(0));
      }
    }
  };

  #onClose = (error?: UaError): void => {
    this.#state = OpenState.Closed;
    this.#dataStream = new Transform();

    if (this.#openResponse) {
      this.#openResponse.reject(error ?? new UaError({code: StatusCode.BadCommunicationError}));
      return;
    }

    if (error) {
      this.emit('error', error);
    }
    this.emit('close');
  };

  close(error?: UaError): void {
    this.#transportProtocol.close(error);
  }
}