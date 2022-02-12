import { TypedEmitter } from 'tiny-typed-emitter';
import { DiagnosticInfo } from '../DataTypes/DiagnosticInfo.js';
import {
  CreateMonitoredItemsRequest,
  CreateMonitoredItemsResponse,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  CreateSubscriptionResponseOptions,
  DataChangeNotification,
  DeleteMonitoredItemsRequest,
  DeleteMonitoredItemsResponse,
  DeleteSubscriptionsRequest,
  DeleteSubscriptionsResponse,
  EventNotificationList,
  ModifyMonitoredItemsRequest,
  ModifyMonitoredItemsResponse,
  ModifySubscriptionRequest,
  ModifySubscriptionResponse,
  MonitoredItemCreateRequest,
  MonitoredItemCreateRequestOptions,
  MonitoredItemModifyRequest,
  MonitoringParameters,
  MonitoringParametersOptions,
  NotificationMessage,
  ResponseHeader,
  SetMonitoringModeRequest,
  SetMonitoringModeResponse,
  SetPublishingModeRequest,
  SetPublishingModeResponse,
  SetTriggeringRequest,
  StatusChangeNotification,
  TransferSubscriptionsRequest,
  TransferSubscriptionsResponse
} from '../DataTypes/Generated.js';
import { Byte, Double, UInt32 } from '../DataTypes/Primitives.js';
import { sendStandardRequest, handleNotificationMessage, handleDataChange, handleEvent, setInternals, handleRecreate } from '../symbols.js';
import { integerIdGenerator } from '../util.js';
import { MonitoredItem } from './MonitoredItem.js';
import { UaClient } from './UaClient.js';
import { StatusCode } from '../DataTypes/StatusCode.js';
import createDebug from 'debug';
import { UaError } from '../UaError.js';

const debug = createDebug('opc-ua:Subscription');

interface SubscriptionInternals {
  requestedPublishingInterval?: Double;
  requestedLifetimeCount?: UInt32;
  requestedMaxKeepAliveCount?: UInt32;
  maxNotificationsPerPublish?: UInt32;
  publishingEnabled?: boolean;
  priority?: Byte;
  responseHeader?: ResponseHeader;
  subscriptionId?: UInt32;
  revisedPublishingInterval?: Double;
  revisedLifetimeCount?: UInt32;
  revisedMaxKeepAliveCount?: UInt32;
  deleted?: boolean;
}

export interface SubscriptionEvents {
  status: (status: StatusCode) => void;
  events: (monitoredItems: MonitoredItem[]) => void;
  values: (monitoredItems: MonitoredItem[]) => void;
  deleted: () => void;
}

export interface SubscriptionOptions {
  client: UaClient;
  request: CreateSubscriptionRequest;
  response: CreateSubscriptionResponse;
}

export class Subscription extends TypedEmitter<SubscriptionEvents> implements CreateSubscriptionResponseOptions {
  /** The UaClient that the Subscription belongs to. */
  get client(): UaClient { return this.#client; }
  #client: UaClient;

  /** This interval defines the cyclic rate that the Subscription is being requested to return Notifications to the Client. */
  get requestedPublishingInterval(): Double { return this.#requestedPublishingInterval; }
  #requestedPublishingInterval: Double;
  /** When the publishing timer has expired this number of times without a Publish request being available to send a NotificationMessage, then the Subscription shall be deleted by the Server. */
  get requestedLifetimeCount(): UInt32 { return this.#requestedLifetimeCount; }
  #requestedLifetimeCount: UInt32;
  /** When the publishing timer has expired this number of times without requiring any NotificationMessage to be sent, the Subscription sends a keep-alive Message to the Client. */
  get requestedMaxKeepAliveCount(): UInt32 { return this.#requestedMaxKeepAliveCount; }
  #requestedMaxKeepAliveCount: UInt32;
  /** The maximum number of notifications that the Client wishes to receive in a single Publish response. */
  get maxNotificationsPerPublish(): UInt32 { return this.#maxNotificationsPerPublish; }
  #maxNotificationsPerPublish: UInt32;
  /** Publishing is enabled for the Subscription. */
  get publishingEnabled(): boolean { return this.#publishingEnabled; }
  #publishingEnabled: boolean;
  /** Indicates the relative priority of the Subscription. */
  get priority(): Byte { return this.#priority; }
  #priority: Byte;

  /** Common response parameters of the create request. */
  get responseHeader(): ResponseHeader { return this.#responseHeader; }
  #responseHeader: ResponseHeader;
  /** The Server-assigned identifier for the Subscription. */
  get subscriptionId(): UInt32 { return this.#subscriptionId; }
  #subscriptionId: UInt32;
  /** The actual publishing interval that the Server will use. */
  get revisedPublishingInterval(): Double { return this.#revisedPublishingInterval; }
  #revisedPublishingInterval: Double;
  /** The actual lifetime count. */
  get revisedLifetimeCount(): UInt32 { return this.#revisedLifetimeCount; }
  #revisedLifetimeCount: UInt32;
  /** The actual maximum keep-alive count. */
  get revisedMaxKeepAliveCount(): UInt32 { return this.#revisedMaxKeepAliveCount; }
  #revisedMaxKeepAliveCount: UInt32;

  /** The Subscription is deleted. */
  get deleted(): boolean { return this.#deleted; }
  #deleted = false;
  /** The status of the subscription. */
  get status(): StatusCode { return this.#status; }
  #status: StatusCode = StatusCode.Good;
  /** The sequence number of the last publish. */
  get sequenceNumber(): UInt32 { return this.#sequenceNumber; }
  #sequenceNumber: UInt32 = 0;
  /** The time of the last publish. */
  get publishTime(): Date { return this.#publishTime; }
  #publishTime: Date = new Date('1601-01-01T00:00:00Z');

  /** The MonitoredItems that belong to this Subscription. */
  get monitoredItems(): ReadonlyArray<MonitoredItem> { return [...this.#monitoredItems.values()]; }
  #monitoredItems = new Set<MonitoredItem>();

  #clientHandle = integerIdGenerator();
  #monitoredItemsHandle = new Map<UInt32, MonitoredItem>();

  constructor(options: SubscriptionOptions) {
    super();
    this.#client = options.client;

    this.#requestedPublishingInterval = options.request.requestedPublishingInterval;
    this.#requestedLifetimeCount = options.request.requestedLifetimeCount;
    this.#requestedMaxKeepAliveCount = options.request.requestedMaxKeepAliveCount;
    this.#maxNotificationsPerPublish = options.request.maxNotificationsPerPublish;
    this.#publishingEnabled = options.request.publishingEnabled;
    this.#priority = options.request.priority;

    this.#responseHeader = options.response.responseHeader;
    this.#subscriptionId = options.response.subscriptionId;
    this.#revisedPublishingInterval = options.response.revisedPublishingInterval;
    this.#revisedLifetimeCount = options.response.revisedLifetimeCount;
    this.#revisedMaxKeepAliveCount = options.response.revisedMaxKeepAliveCount;
  }

  /** This Service is used to create and add one or more MonitoredItems to a Subscription. */
  async createMonitoredItems(request?: CreateMonitoredItemsRequest): Promise<ReadonlyArray<MonitoredItem>> {
    this.#ensureNotDeleted();
    let itemsToCreate = request?.itemsToCreate;
    if (itemsToCreate) {
      itemsToCreate = itemsToCreate.map(itemToCreate => {
        return new MonitoredItemCreateRequest({
          ...itemToCreate,
          requestedParameters: new MonitoringParameters({
            ...itemToCreate.requestedParameters,
            clientHandle: this.#clientHandle.next().value
          })
        });
      });
    }

    const _request = new CreateMonitoredItemsRequest({
      ...request,
      subscriptionId: this.subscriptionId,
      itemsToCreate
    });
    const response = await this.client[sendStandardRequest](CreateMonitoredItemsRequest, _request) as CreateMonitoredItemsResponse;

    if ((response.results?.length ?? 0) !== (_request.itemsToCreate?.length ?? 0)) {
      throw new UaError({code: StatusCode.BadUnexpectedError, reason: 'Response result count not equal to request count'});
    }

    const results = response.results ?? [];
    const diagnosticInfos = response.diagnosticInfos ?? [];

    const _itemsToCreate = itemsToCreate ?? [];

    return results.map((result, i) => {
      const itemToCreate = _itemsToCreate[i] as MonitoredItemCreateRequest;
      const monitoredItem = new MonitoredItem({
        subscription: this,
        result,
        diagnosticInfo: diagnosticInfos[i] ?? new DiagnosticInfo(),
        clientHandle: itemToCreate.requestedParameters.clientHandle,
        request: itemToCreate,
        timestampsToReturn: _request.timestampsToReturn
      });
      if (monitoredItem.statusCode.isGood()) {
        this.#monitoredItems.add(monitoredItem);
        this.#monitoredItemsHandle.set(monitoredItem.clientHandle, monitoredItem);
      } else {
        monitoredItem[setInternals]({deleted: true});
      }
      return monitoredItem;
    });
  }

  /** This Service is used to modify a Subscription. */
  async modify(request?: ModifySubscriptionRequest): Promise<ModifySubscriptionResponse> {
    this.#ensureNotDeleted();
    const _request = new ModifySubscriptionRequest({
      ...request,
      subscriptionId: this.subscriptionId
    });
    const response = await this.client[sendStandardRequest](ModifySubscriptionRequest, _request) as ModifySubscriptionResponse;

    this[setInternals](_request);

    this.#revisedPublishingInterval = response.revisedPublishingInterval;
    this.#revisedLifetimeCount = response.revisedLifetimeCount;
    this.#revisedMaxKeepAliveCount = response.revisedMaxKeepAliveCount;

    return response;
  }

  /** This Service is used to enable sending of Notifications on one or more Subscriptions. */
  async setPublishingMode(request?: SetPublishingModeRequest): Promise<SetPublishingModeResponse> {
    return await this.client.setPublishingMode([this], request);
  }

  /** This Service is used to transfer a Subscription and its MonitoredItems from one Session to another. */
  async transfer(request?: TransferSubscriptionsRequest): Promise<TransferSubscriptionsResponse> {
    return await this.client.transferSubscriptions([this], request);
  }

  /** This Service is invoked to delete one or more Subscriptions that belong to the Client’s Session. */
  async delete(request?: DeleteSubscriptionsRequest): Promise<DeleteSubscriptionsResponse> {
    return await this.client.deleteSubscriptions([this], request);
  }

  /** This Service is used to modify MonitoredItems of a Subscription. */
  async modifyMonitoredItems(itemsToModify: ReadonlyArray<MonitoredItem>, requestedParameters: ReadonlyArray<MonitoringParameters>, request?: ModifyMonitoredItemsRequest): Promise<ModifyMonitoredItemsResponse> {
    this.#ensureNotDeleted();
    if (itemsToModify.length !== requestedParameters.length) {
      throw new UaError({code: StatusCode.BadInvalidArgument, reason: 'ItemsToModify and RequestedParameters are not the same length'});
    }
    const _request = new ModifyMonitoredItemsRequest({
      ...request,
      subscriptionId: this.subscriptionId,
      itemsToModify: itemsToModify.map((itemToModify, i) => {
        this.#ensureMonitoredItem(itemToModify);
        return new MonitoredItemModifyRequest({
          monitoredItemId: itemToModify.monitoredItemId,
          requestedParameters: new MonitoringParameters({
            ...requestedParameters[i],
            clientHandle: itemToModify.clientHandle
          })
        });
      })
    });
    const response = await this.client[sendStandardRequest](ModifyMonitoredItemsRequest, _request) as ModifyMonitoredItemsResponse;

    if ((response.results?.length ?? 0) !== itemsToModify.length) {
      throw new UaError({code: StatusCode.BadUnexpectedError, reason: 'Response result count not equal to request count'});
    }

    for (const [i, result] of (response.results ?? []).entries()) {
      if (result.statusCode.isGood()) {
        const monitoredItem = itemsToModify[i] as MonitoredItem;
        const itemToModify = _request.itemsToModify?.[i] as MonitoredItemModifyRequest;
        monitoredItem[setInternals]({
          ...result,
          timestampsToReturn: _request.timestampsToReturn,
          requestedParameters: itemToModify.requestedParameters
        });
      }
    }

    return response;
  }

  /** This Service is used to set the monitoring mode for one or more MonitoredItems of a Subscription. */
  async setMonitoringMode(monitoredItems: ReadonlyArray<MonitoredItem>, request?: SetMonitoringModeRequest): Promise<SetMonitoringModeResponse> {
    monitoredItems = [...monitoredItems];
    this.#ensureNotDeleted();
    const _request = new SetMonitoringModeRequest({
      ...request,
      subscriptionId: this.subscriptionId,
      monitoredItemIds: monitoredItems.map(monitoredItem => {
        this.#ensureMonitoredItem(monitoredItem);
        return monitoredItem.monitoredItemId;
      })
    });
    const response = await this.client[sendStandardRequest](SetMonitoringModeRequest, _request) as SetMonitoringModeResponse;

    if ((response.results?.length ?? 0) !== monitoredItems.length) {
      throw new UaError({code: StatusCode.BadUnexpectedError, reason: 'Response result count not equal to request count'});
    }

    for (const [i, result] of (response.results ?? []).entries()) {
      if (result.isGood()) {
        const monitredItem = monitoredItems[i] as MonitoredItem;
        monitredItem[setInternals](_request);
      }
    }

    return response;
  }

  /** This Service is used to remove one or more MonitoredItems of a Subscription. */
  async deleteMonitoredItems(monitoredItems: ReadonlyArray<MonitoredItem>, request?: DeleteMonitoredItemsRequest): Promise<DeleteMonitoredItemsResponse> {
    monitoredItems = [...monitoredItems];
    this.#ensureNotDeleted();
    const _request = new DeleteMonitoredItemsRequest({
      ...request,
      subscriptionId: this.subscriptionId,
      monitoredItemIds: monitoredItems.map(monitoredItem => {
        this.#ensureMonitoredItem(monitoredItem);
        return monitoredItem.monitoredItemId;
      })
    });
    const response = await this.client[sendStandardRequest](DeleteMonitoredItemsRequest, _request) as DeleteMonitoredItemsResponse;

    if ((response.results?.length ?? 0) !== monitoredItems.length) {
      throw new UaError({code: StatusCode.BadUnexpectedError, reason: 'Response result count not equal to request count'});
    }

    for (const [i, result] of (response.results ?? []).entries()) {
      if (result.isGood()) {
        const monitoredItem = monitoredItems[i] as MonitoredItem;
        monitoredItem[setInternals]({deleted: true});
        this.#monitoredItems.delete(monitoredItem);
        this.#monitoredItemsHandle.delete(monitoredItem.clientHandle);
      }
    }
    return response;
  }

  [handleNotificationMessage](notificationMessage: NotificationMessage): void {
    debug(`[${this.subscriptionId}] Handling notification message`);
    if (this.publishTime.valueOf() > notificationMessage.publishTime.valueOf()) {
      return;
    }
    this.#publishTime = notificationMessage.publishTime;
    this.#sequenceNumber = notificationMessage.sequenceNumber;

    for (const notificationData of notificationMessage.notificationData ?? []) {
      const notification = notificationData.body;
      if (notification instanceof DataChangeNotification) {
        const items: MonitoredItem[] = [];
        for (const handleValue of notification.monitoredItems ?? []) {
          const monitoredItem = this.#monitoredItemsHandle.get(handleValue.clientHandle);
          if (monitoredItem) {
            monitoredItem[handleDataChange](handleValue.value);
            items.push(monitoredItem);
          }
        }
        this.emit('values', items);
      } 
      else if (notification instanceof EventNotificationList) {
        const items: MonitoredItem[] = [];
        for (const event of notification.events ?? []) {
          const monitoredItem = this.#monitoredItemsHandle.get(event.clientHandle);
          if (monitoredItem) {
            monitoredItem[handleEvent](event.eventFields);
            items.push(monitoredItem);
          }
        }
        this.emit('events', items);
      } 
      else if (notification instanceof StatusChangeNotification) {
        this.#status = notification.status;
        this.emit('status', notification.status);
      }
      else {
        continue;
      }
    }
  }

  [setInternals](options: SubscriptionInternals): void {
    const _deleted = this.deleted;

    this.#requestedPublishingInterval = options.requestedPublishingInterval ?? this.requestedPublishingInterval;
    this.#requestedLifetimeCount = options.requestedLifetimeCount ?? this.requestedLifetimeCount;
    this.#requestedMaxKeepAliveCount = options.requestedMaxKeepAliveCount ?? this.requestedMaxKeepAliveCount;
    this.#maxNotificationsPerPublish = options.maxNotificationsPerPublish ?? this.maxNotificationsPerPublish;
    this.#publishingEnabled = options.publishingEnabled ?? this.publishingEnabled;
    this.#priority = options.priority ?? this.priority;
    this.#responseHeader = options.responseHeader ?? this.responseHeader;
    this.#subscriptionId = options.subscriptionId ?? this.subscriptionId;
    this.#revisedPublishingInterval = options.revisedPublishingInterval ?? this.revisedPublishingInterval;
    this.#revisedLifetimeCount = options.revisedLifetimeCount ?? this.revisedLifetimeCount;
    this.#revisedMaxKeepAliveCount = options.revisedMaxKeepAliveCount ?? this.revisedMaxKeepAliveCount;
    this.#deleted = options.deleted ?? this.deleted;

    if (this.deleted && !_deleted) {
      this.emit('deleted');
    }
  }

  async [handleRecreate](): Promise<void> {
    debug(`[${this.subscriptionId}] Recreating monitored items`);

    const groups = [...this.#monitoredItems].reduce((ack, cur) => {
      ack[cur.timestampsToReturn] = ack[cur.timestampsToReturn] ?? [];
      ack[cur.timestampsToReturn]?.push(cur);
      return ack;
    }, {} as Record<number, MonitoredItem[]>);

    for (const [timestampsToReturn, monitoredItems] of Object.entries(groups)) {
      const _request = new CreateMonitoredItemsRequest({
        subscriptionId: this.subscriptionId,
        timestampsToReturn: parseInt(timestampsToReturn),
        itemsToCreate: monitoredItems.map(monitoredItem => {
          return new MonitoredItemCreateRequest({
            ...(monitoredItem as MonitoredItemCreateRequestOptions),
            requestedParameters: new MonitoringParameters({
              ...(monitoredItem.requestedParameters as MonitoringParametersOptions),
              clientHandle: monitoredItem.clientHandle
            })
          });
        })
      });
  
      const response = await this.client[sendStandardRequest](CreateMonitoredItemsRequest, _request) as CreateMonitoredItemsResponse;

      if ((response.results?.length ?? 0) !== monitoredItems.length) {
        throw new UaError({code: StatusCode.BadUnexpectedError, reason: 'Response result count not equal to request count'});
      }
  
      const results = response.results ?? [];
      const diagnosticInfos = response.diagnosticInfos ?? [];
      
      for (const [i, result] of results.entries()) {
        const monitoredItem = monitoredItems[i] as MonitoredItem;
        monitoredItem[setInternals](result);
        monitoredItem[setInternals]({
          diagnosticInfo: diagnosticInfos[i]
        });
        
        if (!result.statusCode.isGood()) {
          monitoredItem[setInternals]({deleted: true});
          this.#monitoredItems.delete(monitoredItem);
          this.#monitoredItemsHandle.delete(monitoredItem.clientHandle);
          continue;
        }
  
        if (monitoredItem.triggeringLinks.length) {
          await monitoredItem.setTriggering(new SetTriggeringRequest({
            linksToAdd: monitoredItem.triggeringLinks as UInt32[]
          }));
        }
      }
    }
  }

  #ensureMonitoredItem = (monitoredItem: MonitoredItem): void => {
    if (!this.#monitoredItems.has(monitoredItem)) {
      throw new UaError({code: StatusCode.BadObjectDeleted, reason: "MonitoredItem is deleted or doesn't belong to this subscription"});
    }
  };

  #ensureNotDeleted = (): void => {
    if (this.deleted) {
      throw new UaError({code: StatusCode.BadObjectDeleted});
    }
  };
}