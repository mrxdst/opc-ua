import { Decodable, Encodable } from './BinaryDataEncoding.js';
import { RequestHeader, ResponseHeader } from './DataTypes/Generated.js';
import { ServiceFault } from './DataTypes/ServiceFault.js';
import * as GeneratedTypes from './DataTypes/Generated.js';
import { ExtensionObject } from './DataTypes/ExtensionObject.js';
import { Guid } from './DataTypes/Guid.js';
import { NodeId } from './DataTypes/NodeId.js';
import { ExpandedNodeId } from './DataTypes/ExpandedNodeId.js';
import { StatusCode } from './DataTypes/StatusCode.js';
import { QualifiedName } from './DataTypes/QualifiedName.js';
import { LocalizedText } from './DataTypes/LocalizedText.js';
import { DataValue } from './DataTypes/DataValue.js';
import { Variant } from './DataTypes/Variant.js';
import { DiagnosticInfo } from './DataTypes/DiagnosticInfo.js';
import { NodeIds } from './DataTypes/NodeIds.js';
import { typeId } from './symbols.js';

export enum OpenState {
  Closed,
  Opening,
  Open,
  Closing
}

export enum SessionState {
  Closed,
  Creating,
  Activating,
  Activated
}

export type Request = Encodable & {
  [typeId]: NodeIds;
  requestHeader: RequestHeader;
};

export type Response = Encodable & {
  [typeId]: NodeIds;
  responseHeader: ResponseHeader
};

export type EncodableType = 
  Guid |
  NodeId |
  ExpandedNodeId |
  StatusCode |
  QualifiedName |
  LocalizedText |
  ExtensionObject |
  DataValue |
  Variant |
  DiagnosticInfo |
  ServiceFault |
  InstanceType<Extract<typeof GeneratedTypes[keyof typeof GeneratedTypes], Decodable>>;

export type DecodableType = 
  typeof Guid |
  typeof NodeId |
  typeof ExpandedNodeId |
  typeof StatusCode |
  typeof QualifiedName |
  typeof LocalizedText |
  typeof ExtensionObject |
  typeof DataValue |
  typeof Variant |
  typeof DiagnosticInfo |
  typeof ServiceFault |
  Extract<typeof GeneratedTypes[keyof typeof GeneratedTypes], Decodable>;
