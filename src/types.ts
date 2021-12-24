import { Decodable, Encodable } from './BinaryDataEncoding';
import { RequestHeader, ResponseHeader } from './DataTypes/Generated';
import { ServiceFault } from './DataTypes/ServiceFault';
import * as GeneratedTypes from './DataTypes/Generated';
import { ExtensionObject } from './DataTypes/ExtensionObject';
import { Guid } from './DataTypes/Guid';
import { NodeId } from './DataTypes/NodeId';
import { ExpandedNodeId } from './DataTypes/ExpandedNodeId';
import { StatusCode } from './DataTypes/StatusCode';
import { QualifiedName } from './DataTypes/QualifiedName';
import { LocalizedText } from './DataTypes/LocalizedText';
import { DataValue } from './DataTypes/DataValue';
import { Variant } from './DataTypes/Variant';
import { DiagnosticInfo } from './DataTypes/DiagnosticInfo';
import { NodeIds } from './DataTypes/NodeIds';
import { typeId } from './symbols';

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
