import { EventEmitter } from 'events';
import TypedEmitter from 'typed-emitter';
import PQueue from 'p-queue';
import { 
  ActivateSessionRequest,
  ActivateSessionResponse,
  AddNodesRequest,
  AddNodesResponse,
  AddReferencesRequest,
  AddReferencesResponse,
  AnonymousIdentityToken,
  ApplicationDescription,
  ApplicationType,
  BrowseNextRequest,
  BrowseNextResponse,
  BrowseRequest,
  BrowseResponse,
  CallRequest,
  CallResponse,
  CloseSessionRequest,
  CloseSessionResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  DeleteNodesRequest,
  DeleteNodesResponse,
  DeleteReferencesRequest,
  DeleteReferencesResponse,
  DeleteSubscriptionsRequest,
  DeleteSubscriptionsResponse,
  HistoryReadRequest,
  HistoryReadResponse,
  HistoryUpdateRequest,
  HistoryUpdateResponse,
  IssuedIdentityToken,
  MessageSecurityMode,
  PublishRequest,
  PublishResponse,
  QueryFirstRequest,
  QueryFirstResponse,
  QueryNextRequest,
  QueryNextResponse,
  ReadRequest,
  ReadResponse,
  ReadValueId,
  RegisterNodesRequest,
  RegisterNodesResponse,
  RequestHeader,
  SetPublishingModeRequest,
  SetPublishingModeResponse,
  SignatureData,
  SubscriptionAcknowledgement,
  TimestampsToReturn,
  TransferSubscriptionsRequest,
  TransferSubscriptionsResponse,
  TranslateBrowsePathsToNodeIdsRequest,
  TranslateBrowsePathsToNodeIdsResponse,
  UnregisterNodesRequest,
  UnregisterNodesResponse,
  UserNameIdentityToken,
  WriteRequest,
  WriteResponse,
  X509IdentityToken
} from '../DataTypes/Generated';
import { NodeId } from '../DataTypes/NodeId';
import { Double, UaString, UInt32 } from '../DataTypes/Primitives';
import { ClientSecureConversation } from '../SecureConversation/ClientSecureConversation';
import { BinaryDataEncoder, Decodable } from '../BinaryDataEncoding';
import { LocalizedText } from '../DataTypes/LocalizedText';
import { Request, Response, SessionState } from '../types';
import { setInternals, handleNotificationMessage, handleRecreate, sendStandardRequest } from '../symbols';
import { Subscription } from './Subscription';
import createDebug from 'debug';
import { ExtensionObject } from '../DataTypes/ExtensionObject';
import { NodeIds } from '../DataTypes/NodeIds';
import { ServiceFault } from '../DataTypes/ServiceFault';
import { AttributeIds } from '../DataTypes/AttributeIds';
import { UaError } from '../UaError';
import { StatusCode } from '../DataTypes/StatusCode';

const debug = createDebug('opc-ua:UaClient');

export interface UaClientOptions {
  /** The endpoint url to connect to. */
  endpointUrl: string;
  /** The requested lifetime of the SecureChannel. */
  requestedLifetime?: UInt32;
  /** The MessageSecurityMode of the SecureChannel */
  securityMode?: MessageSecurityMode;
  /** A localized descriptive name for the application. */
  applicationName?: LocalizedText;
  /** Requested maximum number of milliseconds that a Session should remain open without activity. */
  requestedSessionTimeout?: Double;
  /** The globally unique identifier for the product. */
  productUri?: UaString;
  /** Human readable string that identifies the Session. */
  sessionName?: UaString;
  /** The credentials of the user associated with the Client application. */
  userIdentityToken?: AnonymousIdentityToken | UserNameIdentityToken | X509IdentityToken | IssuedIdentityToken;
  /** If the Client specified a user identity token that supports digital signatures, then it shall create a signature and pass it as this parameter. */
  userTokenSignature?: SignatureData;
  /** Automatically reconnect the client if it disconnects from the server. */
  autoReconnect?: boolean;
  /** Timeout between reconnect attempts. The first attempt is instantaneously. */
  reconnectTimeout?: number;
  /** The connect timeout and default request timeout. */
  timeout?: number;
}

export interface UaClientEvents {
  connecting: () => void;
  connected: () => void;
  disconnecting: () => void;
  disconnected: () => void;
  error: (error: UaError) => void;
}

export class UaClient extends (EventEmitter as new () => TypedEmitter<UaClientEvents>) implements UaClientOptions {
  /** A localized descriptive name for the application. */
  get applicationName(): LocalizedText { return this.#applicationName; }
  #applicationName: LocalizedText;
  /** Requested maximum number of milliseconds that a Session should remain open without activity. */
  get requestedSessionTimeout(): Double { return this.#requestedSessionTimeout; }
  #requestedSessionTimeout: Double;
  /** The globally unique identifier for the product. */
  get productUri(): UaString { return this.#productUri; }
  #productUri: UaString;
  /** Human readable string that identifies the Session. */
  get sessionName(): UaString { return this.#sessionName; }
  #sessionName: UaString;
  
  /** The endpoint url to connect to. */
  get endpointUrl(): string { return this.#secureConversation.endpointUrl; }
  /** The MessageSecurityMode of the SecureChannel */
  get securityMode(): MessageSecurityMode { return this.#secureConversation.securityMode; }
  /** The requested lifetime of the SecureChannel. */
  get requestedLifetime(): UInt32 { return this.#secureConversation.requestedLifetime; }

  /** The credentials of the user associated with the Client application. */
  get userIdentityToken(): AnonymousIdentityToken | UserNameIdentityToken | X509IdentityToken | IssuedIdentityToken | undefined { return this.#userIdentityToken; }
  /** If the Client specified a user identity token that supports digital signatures, then it shall create a signature and pass it as this parameter. */
  get userTokenSignature(): SignatureData | undefined { return this.#userTokenSignature; }

  /** Automatically reconnect the client if it disconnects from the server. */
  autoReconnect: boolean;
  /** Timeout between reconnect attempts. The first attempt is instantaneously. */
  reconnectTimeout: number;
  /** The connect timeout and default request timeout. */
  get timeout(): number { return this.#secureConversation.openTimeout; }
  set timeout(value: number) { this.#secureConversation.openTimeout = value; }

  /** The revised lifetime of the SecureChannel. */
  get revisedLifetime(): UInt32 { return this.#secureConversation.revisedLifetime; }
  /** The revised lifetime of the Session. */
  get revisedSessionTimeout(): Double { return this.#revisedSessionTimeout; }
  #revisedSessionTimeout: Double = 0;
  
  /** Returns true if the client is connected and ready for use. */
  get connected(): boolean { return this.#connected; }
  #connected = false;

  /** The Subscriptions that belong to this UaClient. */
  get subscriptions(): ReadonlyArray<Subscription> { return [...this.#subscriptions.values()]; }
  #subscriptions = new Set<Subscription>();

  #userIdentityToken?: AnonymousIdentityToken | UserNameIdentityToken | X509IdentityToken | IssuedIdentityToken;
  #userTokenSignature?: SignatureData;

  #secureConversation: ClientSecureConversation;

  #sessionId?: NodeId;
  #authenticationToken?: NodeId;

  #connectQueue = new PQueue({concurrency: 1});
  #sessionState = SessionState.Closed;
  #manuallyClosed = false;
  #isReconnecting = false;

  #publishLoopTimer: number | undefined;
  #keepAliveTimer: number | undefined;

  #subscriptionsIndex = new Map<UInt32, Subscription>();

  constructor(options: UaClientOptions) {
    super();
    this.#applicationName = options.applicationName ?? new LocalizedText();
    this.#requestedSessionTimeout = options.requestedSessionTimeout ?? 1200_000;
    this.#productUri = options.productUri;
    this.autoReconnect = options.autoReconnect ?? false;
    this.reconnectTimeout = options.reconnectTimeout ?? 2_000;

    this.#userIdentityToken = options.userIdentityToken;
    this.#userTokenSignature = options.userTokenSignature;

    this.#secureConversation = new ClientSecureConversation({
      endpointUrl: options.endpointUrl,
      requestedLifetime: options.requestedLifetime ?? 3600_000,
      securityMode: options.securityMode ?? MessageSecurityMode.None,
      openTimeout: options.timeout ?? 30_000
    });

    this.#secureConversation.on('error', this.#onClose);
    this.#secureConversation.on('close', this.#onClose);
  }

  async connect(): Promise<void> {
    return await this.#connectQueue.add(async () => {
      try {
        if (this.connected) {
          return;
        }
        this.emit('connecting');
        this.#manuallyClosed = false;
        await this.#secureConversation.open();
        await this.#activate();
        await this.#recreateSubscriptions();
        this.#startKeepAlive();
        debug('Connected');
        this.#connected = true;
        setTimeout(() => {
          this.connected && this.emit('connected');
        });
      } catch (e) {
        debug(`Connect error: ${(e as Error)?.message}`);
        throw e;
      }
    });    
  }

  async disconnect(): Promise<void> {
    this.#manuallyClosed = true;
    await this.#secureConversation.close();
  }

  #activate = async (): Promise<void> => {
    
    const createSession = async (): Promise<CreateSessionResponse> => {
      const _request = new CreateSessionRequest({
        clientDescription: new ApplicationDescription({
          applicationName: this.applicationName,
          productUri: this.productUri,
          applicationType: ApplicationType.Client,
        }),
        endpointUrl: this.endpointUrl,
        sessionName: this.sessionName,
        requestedSessionTimeout: this.requestedSessionTimeout,
        requestHeader: new RequestHeader({
          timestamp: new Date(),
          timeoutHint: this.timeout
        })
      });

      return await this.#sendRawRequest(_request) as CreateSessionResponse;
    };

    const activateSession = async (): Promise<void> => {
      let userIdentityToken: ExtensionObject | undefined;
      if (this.#userIdentityToken) {
        let typeId: NodeIds;
        if (this.#userIdentityToken instanceof AnonymousIdentityToken) {
          typeId = NodeIds.AnonymousIdentityToken_Encoding_DefaultBinary;
        } else if (this.#userIdentityToken instanceof UserNameIdentityToken) {
          typeId = NodeIds.UserNameIdentityToken_Encoding_DefaultBinary;
        } else if (this.#userIdentityToken instanceof X509IdentityToken) {
          typeId = NodeIds.X509IdentityToken_Encoding_DefaultBinary;
        } else {
          typeId = NodeIds.IssuedIdentityToken_Encoding_DefaultBinary;
        }

        userIdentityToken = new ExtensionObject({
          typeId: NodeId.parse(typeId),
          body: BinaryDataEncoder.encodeType(this.#userIdentityToken)
        });
      }
      
      const _request = new ActivateSessionRequest({
        userIdentityToken,
        userTokenSignature: this.#userTokenSignature,
        requestHeader: this.#newRequestHeader(),
      });

      await this.#sendRawRequest(_request) as ActivateSessionResponse;
    };

    debug('Activating session');
    try {
      this.#sessionState = SessionState.Activating;
      await activateSession();
      this.#sessionState = SessionState.Activated;
    } catch (e) {
      if (e instanceof ServiceFault) {
        debug('Creating session');
        this.#sessionState = SessionState.Creating;
        const response = await createSession();
        this.#authenticationToken = response.authenticationToken;
        this.#sessionId = response.sessionId;
        debug('Activating session');
        this.#sessionState = SessionState.Activating;
        await activateSession();
        this.#sessionState = SessionState.Activated;
      } else {
        throw e;
      }
    }
    debug('Session activated');
  }

  async closeSessionAndDisconnect(): Promise<void> {
    this.emit('disconnecting');
    const request = new CloseSessionRequest({deleteSubscriptions: true});
    try {
      await this[sendStandardRequest](CloseSessionRequest, request) as CloseSessionResponse;
    } catch (e) {
      // Nothing
    }
    await this.disconnect();
  }

  /** This Service is used to add one or more Nodes into the AddressSpace hierarchy. */
  async addNodes(request?: AddNodesRequest): Promise<AddNodesResponse> {
    return await this[sendStandardRequest](AddNodesRequest, request) as AddNodesResponse;
  }

  /** This Service is used to add one or more References to one or more Nodes. */
  async addReferences(request?: AddReferencesRequest): Promise<AddReferencesResponse> {
    return await this[sendStandardRequest](AddReferencesRequest, request) as AddReferencesResponse;
  }

  /** This Service is used to delete one or more Nodes from the AddressSpace. */
  async deleteNodes(request?: DeleteNodesRequest): Promise<DeleteNodesResponse> {
    return await this[sendStandardRequest](DeleteNodesRequest, request) as DeleteNodesResponse;
  }

  /** This Service is used to delete one or more References of a Node. */
  async deleteReferences(request?: DeleteReferencesRequest): Promise<DeleteReferencesResponse> {
    return await this[sendStandardRequest](DeleteReferencesRequest, request) as DeleteReferencesResponse;
  }

  /** This Service is used to discover the References of a specified Node. */
  async browse(request?: BrowseRequest): Promise<BrowseResponse> {
    return await this[sendStandardRequest](BrowseRequest, request) as BrowseResponse;
  }

  /** This Service is used to request the next set of Browse or BrowseNext response information that is too large to be sent in a single response. */
  async browseNext(request?: BrowseNextRequest): Promise<BrowseNextResponse> {
    return await this[sendStandardRequest](BrowseNextRequest, request) as BrowseNextResponse;
  }

  /** This Service is used to request that the Server translates one or more browse paths to NodeIds. */
  async translateBrowsePathsToNodeIds(request?: TranslateBrowsePathsToNodeIdsRequest): Promise<TranslateBrowsePathsToNodeIdsResponse> {
    return await this[sendStandardRequest](TranslateBrowsePathsToNodeIdsRequest, request) as TranslateBrowsePathsToNodeIdsResponse;
  }

  /** The RegisterNodes Service can be used by Clients to register the Nodes that they know they will access repeatedly (e.g. Write, Call). */
  async registerNodes(request?: RegisterNodesRequest): Promise<RegisterNodesResponse> {
    return await this[sendStandardRequest](RegisterNodesRequest, request) as RegisterNodesResponse;
  }

  /** This Service is used to unregister NodeIds that have been obtained via the RegisterNodes service. */
  async unregisterNodes(request?: UnregisterNodesRequest): Promise<UnregisterNodesResponse> {
    return await this[sendStandardRequest](UnregisterNodesRequest, request) as UnregisterNodesResponse;
  }

  /** This Service is used to issue a Query request to the Server. */
  async queryFirst(request?: QueryFirstRequest): Promise<QueryFirstResponse> {
    return await this[sendStandardRequest](QueryFirstRequest, request) as QueryFirstResponse;
  }

  /** This Service is used to request the next set of QueryFirst or QueryNext response information that is too large to be sent in a single response. */
  async queryNext(request?: QueryNextRequest): Promise<QueryNextResponse> {
    return await this[sendStandardRequest](QueryNextRequest, request) as QueryNextResponse;
  }

  /** This Service is used to read one or more Attributes of one or more Nodes. */
  async read(request?: ReadRequest): Promise<ReadResponse> {
    return await this[sendStandardRequest](ReadRequest, request) as ReadResponse;
  }

  /** This Service is used to read historical values or Events of one or more Nodes. */
  async historyRead(request?: HistoryReadRequest): Promise<HistoryReadResponse> {
    return await this[sendStandardRequest](HistoryReadRequest, request) as HistoryReadResponse;
  }

  /** This Service is used to write values to one or more Attributes of one or more Nodes. */
  async write(request?: WriteRequest): Promise<WriteResponse> {
    return await this[sendStandardRequest](WriteRequest, request) as WriteResponse;
  }

  /** This Service is used to update historical values or Events of one or more Nodes. */
  async historyUpdate(request?: HistoryUpdateRequest): Promise<HistoryUpdateResponse> {
    return await this[sendStandardRequest](HistoryUpdateRequest, request) as HistoryUpdateResponse;
  }

  /** This Service is used to call (invoke) a list of Methods. */
  async call(request?: CallRequest): Promise<CallResponse> {
    return await this[sendStandardRequest](CallRequest, request) as CallResponse;
  }

  /** This Service is used to create a Subscription. */
  async createSubscription(request?: CreateSubscriptionRequest): Promise<Subscription> {
    const response = await this[sendStandardRequest](CreateSubscriptionRequest, request) as CreateSubscriptionResponse;
    const subscription = new Subscription({
      client: this,
      response,
      request: request ?? new CreateSubscriptionRequest()
    });
    this.#subscriptions.add(subscription);
    this.#subscriptionsIndex.set(subscription.subscriptionId, subscription);
    this.#startPublish();
    return subscription;
  }

  /** This Service is used to enable sending of Notifications on one or more Subscriptions. */
  async setPublishingMode(subscriptions: Subscription[], request?: SetPublishingModeRequest): Promise<SetPublishingModeResponse> {
    subscriptions = [...subscriptions];
    const _request = new SetPublishingModeRequest({
      ...request,
      subscriptionIds: subscriptions.map(subscription => {
        this.#ensureSubscription(subscription);
        return subscription.subscriptionId;
      })
    });
    const response = await this[sendStandardRequest](SetPublishingModeRequest, _request) as SetPublishingModeResponse;

    if ((response.results?.length ?? 0) !== subscriptions.length) {
      throw new UaError({code: StatusCode.BadUnexpectedError, reason: 'Response result count not equal to request count'});
    }

    for (const [i, result] of (response.results ?? []).entries()) {
      if (result.isGood()) {
        const subscription = subscriptions[i] as Subscription;
        subscription[setInternals]({
          publishingEnabled: _request.publishingEnabled
        });
      }
    }

    return response;
  }

  /** This Service is used to transfer a Subscription and its MonitoredItems from one Session to another. */
  async transferSubscriptions(subscriptions: Subscription[], request?: TransferSubscriptionsRequest): Promise<TransferSubscriptionsResponse> {
    subscriptions = [...subscriptions];
    const _request = new TransferSubscriptionsRequest({
      ...request,
      subscriptionIds: subscriptions.map(subscription => {
        this.#ensureSubscription(subscription);
        return subscription.subscriptionId;
      })
    });
    const response = await this[sendStandardRequest](TransferSubscriptionsRequest, _request) as TransferSubscriptionsResponse;

    if ((response.results?.length ?? 0) !== subscriptions.length) {
      throw new UaError({code: StatusCode.BadUnexpectedError, reason: 'Response result count not equal to request count'});
    }

    for (const [i, result] of (response.results ?? []).entries()) {
      if (result.statusCode.isGood()) {
        const subscription = subscriptions[i] as Subscription;
        subscription[setInternals]({deleted: true});
        this.#subscriptions.delete(subscription);
        this.#subscriptionsIndex.delete(subscription.subscriptionId);
      }
    }
    return response;
  }

  /** This Service is invoked to delete one or more Subscriptions that belong to the Client’s Session. */
  async deleteSubscriptions(subscriptions: Subscription[], request?: DeleteSubscriptionsRequest): Promise<DeleteSubscriptionsResponse> {
    subscriptions = [...subscriptions];
    const _request = new DeleteSubscriptionsRequest({
      ...request,
      subscriptionIds: subscriptions.map(subscription => {
        this.#ensureSubscription(subscription);
        return subscription.subscriptionId;
      })
    });
    const response = await this[sendStandardRequest](DeleteSubscriptionsRequest, _request) as DeleteSubscriptionsResponse;

    if ((response.results?.length ?? 0) !== subscriptions.length) {
      throw new UaError({code: StatusCode.BadUnexpectedError, reason: 'Response result count not equal to request count'});
    }

    for (const [i, result] of (response.results ?? []).entries()) {
      if (result.isGood()) {
        const subscription = subscriptions[i] as Subscription;
        subscription[setInternals]({deleted: true});
        this.#subscriptions.delete(subscription);
        this.#subscriptionsIndex.delete(subscription.subscriptionId);
      }
    }
    return response;
  }

  #recreateSubscriptions = async (): Promise<void> => {
    if (!this.#subscriptions.size) {
      return;
    }

    debug('Recreating subscriptions');

    const subscriptions = [...this.#subscriptions.values()];

    // Start over from scratch.
    const deleteRequest = new DeleteSubscriptionsRequest({
      subscriptionIds: subscriptions.map(subscription => subscription.subscriptionId)
    });
    await this[sendStandardRequest](DeleteSubscriptionsRequest, deleteRequest);

    for (const subscription of subscriptions) {
      debug(`[${subscription.subscriptionId}] Recreating subscription`);
      const request = new CreateSubscriptionRequest(subscription);
      const response = await this[sendStandardRequest](CreateSubscriptionRequest, request) as CreateSubscriptionResponse;
      this.#subscriptionsIndex.delete(subscription.subscriptionId);
      this.#subscriptionsIndex.set(response.subscriptionId, subscription);
      subscription[setInternals](response);
      await subscription[handleRecreate]();
    }

    await Promise.resolve();

    this.#startPublish();
  }

  #ensureSubscription = (subscription: Subscription): void => {
    if (!this.#subscriptions.has(subscription)) {
      throw new UaError({code: StatusCode.BadObjectDeleted, reason: "Subscription is deleted or doesn't belong to this client"});
    }
  }

  #startPublish = (): void => {
    if (this.#publishLoopTimer !== undefined) {
      return;
    }
    this.#publishLoopTimer = setTimeout(() => void(publishLoop()));
    debug('Publish loop started');

    const publishLoop = async (): Promise<void> => {
      if (this.#sessionState !== SessionState.Activated) {
        this.#publishLoopTimer = undefined;
        debug('Publish loop ended');
        return;
      }
      let subscriptionToAck: UInt32 = 0;
      let sequenceNumbersToAck: UInt32[] = [];
      debug('Publish');
      const minInterval = [...this.#subscriptions].reduce((ack, s) => Math.min(ack, s.revisedPublishingInterval), Infinity);
      try {
        const request = new PublishRequest({
          requestHeader: new RequestHeader({
            timeoutHint: minInterval + this.timeout
          }),
          subscriptionAcknowledgements: sequenceNumbersToAck.map(sequenceNumber => {
            return new SubscriptionAcknowledgement({
              subscriptionId: subscriptionToAck,
              sequenceNumber
            });
          })
        });
        const response = await this[sendStandardRequest](PublishRequest, request) as PublishResponse;
        debug('Got publish response');
        subscriptionToAck = response.subscriptionId;
        sequenceNumbersToAck = [response.notificationMessage.sequenceNumber];

        const subscription = this.#subscriptionsIndex.get(response.subscriptionId);
        subscription?.[handleNotificationMessage](response.notificationMessage);
        this.#publishLoopTimer = setTimeout(() => void(publishLoop()));
      } catch (e) {
        debug(`Publish error: ${(e as Error)?.message}`);
        this.#publishLoopTimer = setTimeout(() => void(publishLoop()), minInterval) as unknown as number;
      }
    };   
  }

  #startKeepAlive = (): void => {
    if (this.#keepAliveTimer !== undefined) {
      return;
    }
    this.#keepAliveTimer = setTimeout(() => void(keepAlive()));
    debug('Keep alive started');

    const keepAlive = async (): Promise<void> => {
      if (this.#sessionState !== SessionState.Activated) {
        this.#keepAliveTimer = undefined;
        debug('Keep alive ended');
        return;
      }
      
      debug('Send keep alive');
      try {
        await this.read(new ReadRequest({
          timestampsToReturn: TimestampsToReturn.Neither,
          nodesToRead: [
            new ReadValueId({
              attributeId: AttributeIds.Value,
              nodeId: NodeId.parse(NodeIds.Server_ServerStatus_CurrentTime)
            })
          ]
        }));
        debug('Got keep alive response');
      } catch (e) {
        debug(`Keep alive error: ${(e as Error)?.message}`);
      }
      this.#keepAliveTimer = setTimeout(() => void(keepAlive()), 5000) as unknown as number;
    };   
  }

  async [sendStandardRequest](requestType: Decodable & {new(options: Record<string, unknown>): Request}, request?: Request): Promise<Response> {
    if (this.#sessionState !== SessionState.Activated) {
      throw new UaError({code: StatusCode.BadServerNotConnected});
    }

    const _request = new requestType({
      ...request,
      requestHeader: this.#newRequestHeader(request)
    });

    return await this.#secureConversation.sendRequest(_request);
  }

  #sendRawRequest = async (request: Request): Promise<Response> => {
    return await this.#secureConversation.sendRequest(request);
  }

  #newRequestHeader = (request?: Request): RequestHeader => {
    return new RequestHeader({
      ...request?.requestHeader,
      authenticationToken: this.#authenticationToken,
      timestamp: new Date(),
      timeoutHint: request?.requestHeader?.timeoutHint || this.timeout
    });
  }

  #startReconnect = (): void => {
    
    if (this.#isReconnecting || !this.autoReconnect || this.#manuallyClosed) {
      return;
    }
    this.#isReconnecting = true;

    const reconnect = async (): Promise<void> => {
      if (!this.autoReconnect || this.#manuallyClosed) {
        return;
      }
      try {
        await this.connect();
        this.#isReconnecting = false;
      } catch (e) {
        setTimeout(() => void(reconnect()), this.reconnectTimeout);
      }
    };

    setTimeout(() => void(reconnect()));
  }

  #onClose = (error?: UaError): void => {
    const connected = this.connected;
    this.#sessionState = SessionState.Closed;
    this.#connected = false;
    clearTimeout(this.#publishLoopTimer);
    clearTimeout(this.#keepAliveTimer);

    if (connected) {
      if (error && !this.autoReconnect) {
        this.emit('error', error);
      }
  
      this.emit('disconnected');
    }
    
    this.#startReconnect();
  }
}