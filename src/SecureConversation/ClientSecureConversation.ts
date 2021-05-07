import TypedEmitter from 'typed-emitter';
import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import pDefer from 'p-defer';
import { BinaryDataDecoder, BinaryDataEncoder, Decodable } from '../BinaryDataEncoding';
import { NodeId } from '../DataTypes/NodeId';
import { NodeIds } from '../DataTypes/NodeIds';
import { UInt32 } from '../DataTypes/Primitives';
import {
  ChannelSecurityToken,
  OpenSecureChannelRequest,
  OpenSecureChannelResponse,
  CloseSecureChannelRequest,
  CloseSecureChannelResponse,
  RequestHeader,
  SecurityTokenRequestType,
  MessageSecurityMode
} from '../DataTypes/Generated';
import { UaError } from '../UaError';
import { chunkBody } from './util';
import { ExpandedNodeId } from '../DataTypes/ExpandedNodeId';
import * as GeneratedTypes from '../DataTypes/Generated';
import { decode, typeId } from '../symbols';
import { ClientConnectionProtocol } from '../TransportProtocol/ConnectionProtocol/ClientConnectionProtocol';
import { DecodableType, OpenState, Request, Response } from '../types';
import { IsFinal, Message, MessageType } from './Message';
import { AbortMessageBody } from './AbortMessageBody';
import { integerIdGenerator } from '../util';
import createDebug from 'debug';
import { ServiceFault } from '../DataTypes/ServiceFault';
import { StatusCode } from '../DataTypes/StatusCode';

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

export class ClientSecureConversation extends (EventEmitter as new () => TypedEmitter<ClientSecureConversationEvents>) implements ClientSecureConversationOptions {
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
  
  #securityToken?: ChannelSecurityToken;

  #renewSecurityTokenTimer?: number | NodeJS.Timeout;
  #receivedSequenceNumber: UInt32 | undefined;
  #receivedMessages = new Map<UInt32, Message[]>();
  #openSecureChannelQueue = new PQueue({concurrency: 1});
  #sendQueue = new PQueue({concurrency: 10});
  #deferredResponses = new Map<UInt32, pDefer.DeferredPromise<Response>>();

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

      const _typeId = (request as unknown as {constructor: {[typeId]: NodeIds}}).constructor[typeId];

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

      setTimeout(() => {
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
  
      let name = NodeIds[typeId.nodeId.value];
      if (!name || !name.endsWith('_Encoding_DefaultBinary')) {
        throw new UaError({code: StatusCode.BadDecodingError, reason: 'Response uses wrong encoding'});
      }
      name = name.replace(/_Encoding_DefaultBinary$/, '');

      debug(`Received response: ${name}`);

      let decodable: DecodableType | undefined;
      switch (name) {
        case 'ServiceFault':
          decodable = ServiceFault;
          break;
        default:
          if (typeId.nodeId.value !== NodeIds[`${name.replace(/Request$/, 'Response')}_Encoding_DefaultBinary` as keyof typeof NodeIds]) {
            throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid response for request'});
          }
          decodable = GeneratedTypes[name as keyof typeof GeneratedTypes] as DecodableType;
      }
  
      if (!decodable || !(decode in decodable)) {
        throw new UaError({code: StatusCode.BadDecodingError});
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
      this.#transport.close(e);
    }
  }

  #newRequestHeader = (): RequestHeader => {
    return new RequestHeader({
      timestamp: new Date(),
      timeoutHint: this.openTimeout
    });
  }

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
  }

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
  }

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