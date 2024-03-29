import EventEmitter from 'eventemitter3';
import PQueue from 'p-queue';
import pDefer, { DeferredPromise } from 'p-defer';
import { BinaryDataDecoder, BinaryDataEncoder, Decodable } from '../BinaryDataEncoding.js';
import { NodeId } from '../DataTypes/NodeId.js';
import { NodeIds } from '../DataTypes/NodeIds.js';
import { UInt32 } from '../DataTypes/Primitives.js';
import {
  ChannelSecurityToken,
  OpenSecureChannelRequest,
  OpenSecureChannelResponse,
  CloseSecureChannelRequest,
  CloseSecureChannelResponse,
  RequestHeader,
  SecurityTokenRequestType,
  MessageSecurityMode
} from '../DataTypes/Generated.js';
import { UaError } from '../UaError.js';
import { chunkBody } from './util.js';
import { ExpandedNodeId } from '../DataTypes/ExpandedNodeId.js';
import { typeId } from '../symbols.js';
import { ClientConnectionProtocol } from '../TransportProtocol/ConnectionProtocol/ClientConnectionProtocol.js';
import { OpenState, Request, Response } from '../types.js';
import { IsFinal, Message, MessageType } from './Message.js';
import { AbortMessageBody } from './AbortMessageBody.js';
import { getTypeFromTypeId, integerIdGenerator } from '../util.js';
import createDebug from 'debug';
import { ServiceFault } from '../DataTypes/ServiceFault.js';
import { StatusCode } from '../DataTypes/StatusCode.js';

const debug = createDebug('opc-ua:ClientSecureConversation');

export interface ClientSecureConversationEvents {
  close: () => void;
  error: (error: UaError) => void;
}

export interface ClientSecureConversationOptions {
  endpointUrl: string;
  securityMode?: MessageSecurityMode;
  requestedLifetime: UInt32;
  openTimeout: UInt32;
}

export class ClientSecureConversation extends EventEmitter<ClientSecureConversationEvents> implements ClientSecureConversationOptions {
  get endpointUrl(): string { return this.#endpointUrl; }
  #endpointUrl: string;
  get securityMode(): MessageSecurityMode { return this.#securityMode; }
  #securityMode: MessageSecurityMode;
  get requestedLifetime(): UInt32 { return this.#requestedLifetime; }
  #requestedLifetime: UInt32;
  get openTimeout(): number { return this.#transport.openTimeout; }
  set openTimeout(value: number) { this.#transport.openTimeout = value; }

  get state(): OpenState{ return this.#state; }
  #state = OpenState.Closed;

  get revisedLifetime(): UInt32 { return this.#securityToken?.revisedLifetime ?? 0; }

  #transport: ClientConnectionProtocol;

  #requestId = integerIdGenerator();
  #sequenceNumber = integerIdGenerator();
  
  #securityToken: ChannelSecurityToken | undefined;

  #renewSecurityTokenTimer?: number | NodeJS.Timeout;
  #receivedSequenceNumber: UInt32 | undefined;
  #receivedMessages = new Map<UInt32, Message[]>();
  #openSecureChannelQueue = new PQueue({concurrency: 1});
  #sendQueue = new PQueue({concurrency: 10});
  #deferredResponses = new Map<UInt32, DeferredPromise<Response>>();

  constructor(options: ClientSecureConversationOptions) {
    super();
    this.#endpointUrl = options.endpointUrl;
    this.#securityMode = options.securityMode ?? MessageSecurityMode.None;
    this.#requestedLifetime = options.requestedLifetime;

    if (this.securityMode !== MessageSecurityMode.None) {
      throw new UaError({code: StatusCode.BadNotSupported, reason: 'Only SecurityMode=None is supported'});
    }

    this.#transport = new ClientConnectionProtocol({
      endpointUrl: this.endpointUrl,
      openTimeout: options.openTimeout
    });

    this.#transport.on('close', this.#onClose);
    this.#transport.on('error', this.#onClose);
    this.#transport.on('message', this.#onMessage);
  }

  async open(request?: OpenSecureChannelRequest): Promise<OpenSecureChannelResponse | undefined> {
    return await this.#openSecureChannelQueue.add(async () => {
      try {
        debug('Opening transport');
        await this.#transport.open();
        debug('Transport open');

        debug('Opening secure channel');

        if (this.#state === OpenState.Open) {
          return;
        }

        this.#securityToken = undefined;

        this.#state = OpenState.Opening;
    
        const _request = new OpenSecureChannelRequest({
          ...request,
          requestHeader: new RequestHeader({
            ...request?.requestHeader,
            ...this.#newRequestHeader()
          }),
          clientProtocolVersion: 0,
          requestType: SecurityTokenRequestType.Issue,
          securityMode: this.securityMode,
          requestedLifetime: this.requestedLifetime
        });

        const response = await this.sendRequest(_request) as OpenSecureChannelResponse;

        this.#securityToken = response.securityToken;
  
        this.#state = OpenState.Open;
  
        this.#renewSecurityTokenTimer = setTimeout(() => void(this.#renewSecurityToken()), response.securityToken.revisedLifetime * 0.75);

        debug('Secure channel open');

        return response;
      } catch (e) {
        this.#state = OpenState.Closed;
        throw e;
      }
    });
  }

  sendRequest(request: Request): Promise<Response> {
    return this.#sendQueue.add(async () => {

      const _typeId = request[typeId];

      debug(`Sending request: ${NodeIds[_typeId] ?? _typeId as number}`);

      let messages: Message[];
      const requestId = this.#requestId.next().value;

      if (request instanceof OpenSecureChannelRequest) {
        const bodyEncoder = new BinaryDataEncoder();
        bodyEncoder.writeType(NodeId.parse(NodeIds.OpenSecureChannelRequest_Encoding_DefaultBinary));
        bodyEncoder.writeType(request);
        messages = [new Message({
          messageType: MessageType.OPN,
          isFinal: IsFinal.F,
          securityPolicyUri: 'http://opcfoundation.org/UA/SecurityPolicy#None',
          secureChannelId: this.#securityToken?.channelId ?? 0,
          tokenId: this.#securityToken?.tokenId ?? 0,
          sequenceNumber: this.#sequenceNumber.next().value,
          requestId,
          body: bodyEncoder.finish()
        })];
      } else if (request instanceof CloseSecureChannelRequest) {
        const bodyEncoder = new BinaryDataEncoder();
        bodyEncoder.writeType(NodeId.parse(NodeIds.CloseSecureChannelRequest_Encoding_DefaultBinary));
        bodyEncoder.writeType(request);
        messages = [new Message({
          messageType: MessageType.CLO,
          isFinal: IsFinal.F,
          securityPolicyUri: 'http://opcfoundation.org/UA/SecurityPolicy#None',
          secureChannelId: this.#securityToken?.channelId ?? 0,
          tokenId: this.#securityToken?.tokenId ?? 0,
          sequenceNumber: this.#sequenceNumber.next().value,
          requestId,
          body: bodyEncoder.finish()
        })];
      } else {
        const bodyEncoder = new BinaryDataEncoder();
        bodyEncoder.writeType(NodeId.parse(_typeId));
        bodyEncoder.writeType(request);
    
        const body = bodyEncoder.finish();

        if (this.#transport.maxMessageSize && body.byteLength > this.#transport.maxMessageSize) {
          throw new UaError({code: StatusCode.BadRequestTooLarge});
        }
        
        const bodyChunks = chunkBody({
          messageChunkSize: this.#transport.bufferSize - 12 - 4 - 8,
          body
        });
            
        messages = [];

        for (let i = 0; i < bodyChunks.length; i++) {
          const bodyChunk = bodyChunks[i] as Uint8Array;
          const message = new Message({
            messageType: MessageType.MSG,
            isFinal: (i === bodyChunks.length - 1) ? IsFinal.F : IsFinal.C,
            secureChannelId: this.#securityToken?.channelId ?? 0,
            tokenId: this.#securityToken?.tokenId ?? 0,
            requestId,
            sequenceNumber: this.#sequenceNumber.next().value,
            body: bodyChunk
          });
          messages.push(message);
        }
      }

      if (this.#transport.maxChunkCount && messages.length > this.#transport.maxChunkCount) {
        throw new UaError({code: StatusCode.BadRequestTooLarge});
      }

      const deferredResponse = pDefer<Response>();
      this.#deferredResponses.set(requestId, deferredResponse);

      queueMicrotask(() => {
        const write = async (): Promise<void> => {
          try {
            for (const message of messages) {
              await this.#transport.write(BinaryDataEncoder.encodeType(message));
            }
          } catch (e) {
            deferredResponse.reject(e);
          }
        };
        void(write());
      });

      const timeout = setTimeout(() => {
        this.#transport.close(new UaError({code: StatusCode.BadTimeout}));
      }, request.requestHeader.timeoutHint);

      try {
        return await deferredResponse.promise;
      } finally {
        clearTimeout(timeout);
        this.#deferredResponses.delete(requestId);
      }
    });
  }

  #onMessage = (data: Uint8Array): void => {
    try {
      const message = BinaryDataDecoder.decodeType(data, Message);

      const deferredResponse = this.#deferredResponses.get(message.requestId);

      if (!deferredResponse) {
        throw new UaError({code: StatusCode.BadUnexpectedError, reason: 'Received unexpected message'});
      }
      if (this.#receivedSequenceNumber !== undefined && message.sequenceNumber !== this.#receivedSequenceNumber + 1) {
        throw new UaError({code: StatusCode.BadSequenceNumberInvalid});
      }

      this.#receivedSequenceNumber = message.sequenceNumber;

      let receivedMessages = this.#receivedMessages.get(message.requestId);
      if (!receivedMessages) {
        receivedMessages = [];
        this.#receivedMessages.set(message.requestId, receivedMessages);
      }
  
      switch (message.isFinal) {
        case IsFinal.C: {
          receivedMessages.push(message);
          return;
        }
        case IsFinal.A: {
          const abortMessage = BinaryDataDecoder.decodeType(message.body, AbortMessageBody);
          deferredResponse.reject(new UaError({
            code: abortMessage.error,
            reason: abortMessage.reason
          }));
          return;
        }
        case IsFinal.F: {
          receivedMessages.push(message);
          break;
        }
      }

      const bodyEncoder = new BinaryDataEncoder();
      for (const chunk of receivedMessages) {
        bodyEncoder.writeBytes(chunk.body);
      }
      const body = bodyEncoder.finish();

      this.#receivedMessages.delete(message.requestId);

      const bodyDecoder = new BinaryDataDecoder(body);
  
      const typeId = bodyDecoder.readType(ExpandedNodeId);
      
      if (typeId.namespaceUri || typeId.serverIndex !== 0 || typeof typeId.nodeId.value !== 'number') {
        throw new UaError({code: StatusCode.BadDecodingError});
      }
  
      const name = NodeIds[typeId.nodeId.value];

      if (!name) {
        throw new UaError({ code: StatusCode.BadDecodingError });
      }

      debug(`Received response: ${name || typeId.nodeId.value}`);
      
      const decodable = getTypeFromTypeId(typeId.nodeId.value);
      
      if (!decodable) {
        throw new UaError({ code: StatusCode.BadDecodingError });
      }

      const requestBody = bodyDecoder.readBytes(bodyDecoder.bytesLeft);

      const decodedType = BinaryDataDecoder.decodeType(requestBody, decodable as Decodable) as Response;

      if (decodedType instanceof ServiceFault) {
        deferredResponse.reject(decodedType);
      } else if (!decodedType.responseHeader.serviceResult.isGood())
        deferredResponse.reject(new ServiceFault(decodedType));
      else {
        deferredResponse.resolve(decodedType);
      }
    } catch (e) {
      this.#transport.close(e as UaError);
    }
  };

  #newRequestHeader = (): RequestHeader => {
    return new RequestHeader({
      timestamp: new Date(),
      timeoutHint: this.openTimeout
    });
  };

  #renewSecurityToken = async (): Promise<void> => {
    try {
      debug('Renewing security token');

      const request = new OpenSecureChannelRequest({
        requestHeader: this.#newRequestHeader(),
        clientProtocolVersion: 0,
        requestType: SecurityTokenRequestType.Renew,
        securityMode: this.securityMode,
        requestedLifetime: this.requestedLifetime
      });
  
      const response = await this.sendRequest(request) as OpenSecureChannelResponse;
  
      this.#securityToken = response.securityToken;
  
      this.#renewSecurityTokenTimer = setTimeout(() => void(this.#renewSecurityToken()), response.securityToken.revisedLifetime * 0.75);

      debug('Security token renewed');
    } catch (_e) {
      const e = _e as Error;
      this.#transport.close(e instanceof UaError ? e : new UaError({code: StatusCode.BadCommunicationError, reason: e.message}));
    }
  };

  #onClose = (error?: UaError): void => {
    if (error) {
      debug(`Transport closed with error: ${error.message}`);
    } else {
      debug('Transport closed');
    }
    clearTimeout(this.#renewSecurityTokenTimer as number);
    this.#receivedSequenceNumber = undefined;
    this.#receivedMessages.clear();
    this.#state = OpenState.Closed;

    for (const deferredResponse of this.#deferredResponses.values()) {
      deferredResponse.reject(error ?? new UaError({code: StatusCode.BadCommunicationError}));
    }
    this.#deferredResponses.clear();

    if (error) {
      this.emit('error', error);
    }
    this.emit('close');
  };

  async close(error?: UaError): Promise<void> {
    const _request = new CloseSecureChannelRequest({
      requestHeader: this.#newRequestHeader()      
    });

    try {
      await this.sendRequest(_request) as CloseSecureChannelResponse;
    } catch (e) {
      // Nothing
    }

    this.#transport.close(error);
  }
}