
import TypedEmitter from 'typed-emitter';
import { EventEmitter } from 'events';
import { DataValue } from '../DataTypes/DataValue';
import { DiagnosticInfo } from '../DataTypes/DiagnosticInfo';
import { ExtensionObject } from '../DataTypes/ExtensionObject';
import {
  DeleteMonitoredItemsRequest,
  DeleteMonitoredItemsResponse,
  ModifyMonitoredItemsRequest,
  ModifyMonitoredItemsResponse,
  MonitoredItemCreateRequest,
  MonitoredItemCreateResult,
  MonitoredItemCreateResultOptions,
  MonitoringMode,
  MonitoringParameters,
  ReadValueId,
  SetMonitoringModeRequest,
  SetMonitoringModeResponse,
  SetTriggeringRequest,
  SetTriggeringResponse,
  TimestampsToReturn
} from '../DataTypes/Generated';
import { Double, UInt32 } from '../DataTypes/Primitives';
import { StatusCode } from '../DataTypes/StatusCode';
import { Variant } from '../DataTypes/Variant';
import { sendStandardRequest, handleDataChange, handleEvent, setInternals } from '../symbols';
import { Subscription } from './Subscription';
import createDebug from 'debug';
import { UaError } from '../UaError';

const debug = createDebug('opc-ua:MonitoredItem');

interface MonitoredItemInternals {
  timestampsToReturn?: TimestampsToReturn;
  itemToMonitor?: ReadValueId;
  monitoringMode?: MonitoringMode;
  requestedParameters?: MonitoringParameters;
  triggeringLinks?: UInt32[];
  statusCode?: StatusCode;
  monitoredItemId?: UInt32;
  revisedSamplingInterval?: Double;
  revisedQueueSize?: UInt32;
  filterResult?: ExtensionObject;
  diagnosticInfo?: DiagnosticInfo;
  clientHandle?: UInt32;
  deleted?: boolean;
}

export interface MonitoredItemEvents {
  value: (value: DataValue) => void;
  event: (eventFields?: Variant[]) => void;
  deleted: () => void;
}

export interface MonitoredItemOptions {
  subscription: Subscription;
  timestampsToReturn: TimestampsToReturn;
  request: MonitoredItemCreateRequest;
  result: MonitoredItemCreateResult;
  diagnosticInfo: DiagnosticInfo;
  clientHandle: UInt32;
}

export class MonitoredItem extends (EventEmitter as new () => TypedEmitter<MonitoredItemEvents>) implements MonitoredItemCreateResultOptions {
  /** The Subscription that the MonitoredItem belongs to. */
  get subscription(): Subscription { return this.#subscription; }
  #subscription: Subscription;

  /** The timestamp Attributes to be transmitted for the MonitoredItem. */
  get timestampsToReturn(): TimestampsToReturn { return this.#timestampsToReturn; }
  #timestampsToReturn: TimestampsToReturn;
  /** Identifies the item in the AddressSpace to monitor. */
  get itemToMonitor(): ReadValueId { return this.#itemToMonitor; }
  #itemToMonitor: ReadValueId;
  /** The monitoring mode of the MonitoredItem.  */
  get monitoringMode(): MonitoringMode { return this.#monitoringMode; }
  #monitoringMode: MonitoringMode;
  /** The requested monitoring parameters. */
  get requestedParameters(): MonitoringParameters { return this.#requestedParameters; }
  #requestedParameters: MonitoringParameters;
  /** Triggering links. */
  get triggeringLinks(): ReadonlyArray<UInt32> { return [...this.#triggeringLinks]; }
  #triggeringLinks: ReadonlyArray<UInt32>;

  /** StatusCode for the MonitoredItem. */
  get statusCode(): StatusCode { return this.#statusCode; }
  #statusCode: StatusCode;
  /** Server-assigned id for the MonitoredItem. */
  get monitoredItemId(): UInt32 { return this.#monitoredItemId; }
  #monitoredItemId: UInt32;
  /** The actual sampling interval that the Server will use. */
  get revisedSamplingInterval(): Double { return this.#revisedSamplingInterval; }
  #revisedSamplingInterval: Double;
  /** The actual queue size that the Server will use. */
  get revisedQueueSize(): UInt32 { return this.#revisedQueueSize; }
  #revisedQueueSize: UInt32;
  /** Contains any revised parameter values or error results associated with the MonitoringFilter specified in requestedParameters. */
  get filterResult(): ExtensionObject { return this.#filterResult; }
  #filterResult: ExtensionObject;
  /** Diagnostic information for the MonitoredItem. */
  get diagnosticInfo(): DiagnosticInfo { return this.#diagnosticInfo; }
  #diagnosticInfo: DiagnosticInfo;
  /** Client-assigned id for the MonitoredItem. */
  get clientHandle(): UInt32 { return this.#clientHandle; }
  #clientHandle: UInt32;

  /** The current value of the MonitoredItem. */
  get value(): DataValue { return this.#value; }
  #value: DataValue = new DataValue();
  /** The last received event fields of the MonitoredItem. */
  get eventFields(): Variant[] | undefined {return this.#eventFields; }
  #eventFields?: Variant[];
  /** The MonitoredItem is deleted. */
  get deleted(): boolean { return this.#deleted; }
  #deleted = false;

  constructor(options: MonitoredItemOptions) {
    super();
    this.#subscription = options.subscription;
    
    this.#timestampsToReturn = options.timestampsToReturn;
    this.#itemToMonitor = options.request.itemToMonitor;
    this.#monitoringMode = options.request.monitoringMode;
    this.#requestedParameters = options.request.requestedParameters;
    this.#triggeringLinks = [];

    this.#statusCode = options.result.statusCode;
    this.#monitoredItemId = options.result.monitoredItemId;
    this.#revisedSamplingInterval = options.result.revisedSamplingInterval;
    this.#revisedQueueSize = options.result.revisedQueueSize;
    this.#filterResult = options.result.filterResult;
    this.#diagnosticInfo = options.diagnosticInfo;
    this.#clientHandle = options.clientHandle;
  }

  /** This Service is used to modify MonitoredItems of a Subscription. */
  async modify(requestedParameters: MonitoringParameters, request?: ModifyMonitoredItemsRequest): Promise<ModifyMonitoredItemsResponse> {
    return await this.subscription.modifyMonitoredItems([this], [requestedParameters], request);
  }

  /** This Service is used to set the monitoring mode for one or more MonitoredItems of a Subscription. */
  async setMonitoringMode(request?: SetMonitoringModeRequest): Promise<SetMonitoringModeResponse> {
    return await this.subscription.setMonitoringMode([this], request);
  }

  /** This Service is used to create and delete triggering links for a triggering item. */
  async setTriggering(request?: SetTriggeringRequest): Promise<SetTriggeringResponse> {
    this.#ensureNotDeleted();
    const _request = new SetTriggeringRequest({
      ...request,
      linksToRemove: request?.linksToRemove ? [...request.linksToRemove] : undefined,
      linksToAdd: request?.linksToAdd ? [...request.linksToAdd] : undefined,
      subscriptionId: this.subscription.subscriptionId,
      triggeringItemId: this.monitoredItemId
    });

    const response = await this.subscription.client[sendStandardRequest](SetTriggeringRequest, _request) as SetTriggeringResponse;

    if ((response.removeResults?.length ?? 0) !== (request?.linksToRemove?.length ?? 0) || (response.addResults?.length ?? 0) !== (request?.linksToAdd?.length ?? 0)) {
      throw new UaError({code: StatusCode.BadUnexpectedError, reason: 'Response result count not equal to request count'});
    }

    const linksToRemove: UInt32[] = [];
    const linksToAdd: UInt32[] = [];

    for (const [i, result] of (response.removeResults ?? []).entries()) {
      if (result.isGood()) {
        linksToRemove.push(_request.linksToRemove?.[i] as UInt32);
      }
    }

    for (const [i, result] of (response.addResults ?? []).entries()) {
      if (result.isGood()) {
        linksToAdd.push(_request.linksToAdd?.[i] as UInt32);
      }
    }

    this.#triggeringLinks = this.triggeringLinks.filter(l => !(linksToRemove.includes(l) || linksToAdd.includes(l)));
    (this.triggeringLinks as UInt32[]).push(...linksToAdd);

    return response;
  }

  /** This Service is used to remove one or more MonitoredItems of a Subscription. */
  async delete(request?: DeleteMonitoredItemsRequest): Promise<DeleteMonitoredItemsResponse> {
    return await this.subscription.deleteMonitoredItems([this], request);
  }

  [handleDataChange](value: DataValue): void {
    debug(`[${this.clientHandle}] Handling data change`);
    this.#value = value;
    this.emit('value', value);
  }

  [handleEvent](eventFields?: Variant[]): void {
    debug(`[${this.clientHandle}] Handling event fields`);
    this.#eventFields = eventFields;
    this.emit('event', eventFields);
  }

  [setInternals](options: MonitoredItemInternals): void {
    const _deleted = this.deleted;

    this.#timestampsToReturn = options.timestampsToReturn ?? this.timestampsToReturn;
    this.#itemToMonitor = options.itemToMonitor ?? this.itemToMonitor;
    this.#monitoringMode = options.monitoringMode ?? this.monitoringMode;
    this.#requestedParameters = options.requestedParameters ?? this.requestedParameters;
    this.#triggeringLinks = options.triggeringLinks ?? this.triggeringLinks;
    this.#statusCode = options.statusCode ?? this.statusCode;
    this.#monitoredItemId = options.monitoredItemId ?? this.monitoredItemId;
    this.#revisedSamplingInterval = options.revisedSamplingInterval ?? this.revisedSamplingInterval;
    this.#revisedQueueSize = options.revisedQueueSize ?? this.revisedQueueSize;
    this.#filterResult = options.filterResult ?? this.filterResult;
    this.#diagnosticInfo = options.diagnosticInfo ?? this.diagnosticInfo;
    this.#clientHandle = options.clientHandle ?? this.clientHandle;
    this.#deleted = options.deleted ?? this.deleted;

    if (this.deleted && !_deleted) {
      this.emit('deleted');
    }
  }

  #ensureNotDeleted = (): void => {
    if (this.deleted) {
      throw new UaError({code: StatusCode.BadObjectDeleted});
    }
  };
}