import { DecodableType } from './types.js';
import {
  SByte,
  Byte,
  Int16,
  UInt16,
  Int32,
  UInt32,
  Int64,
  UInt64,
  ByteString,
  UaString
} from './DataTypes/Primitives.js';
import * as GeneratedTypes from './DataTypes/Generated.js';
import { decode, encode } from './symbols.js';
import { Decodable, Encodable } from './BinaryDataEncoding.js';
import { NodeIds } from './DataTypes/NodeIds.js';
import { Guid } from './DataTypes/Guid.js';
import { NodeId } from './DataTypes/NodeId.js';
import { ExpandedNodeId } from './DataTypes/ExpandedNodeId.js';
import { StatusCode } from './DataTypes/StatusCode.js';
import { QualifiedName } from './DataTypes/QualifiedName.js';
import { LocalizedText } from './DataTypes/LocalizedText.js';
import { ExtensionObject } from './DataTypes/ExtensionObject.js';
import { DataValue } from './DataTypes/DataValue.js';
import { Variant } from './DataTypes/Variant.js';
import { DiagnosticInfo } from './DataTypes/DiagnosticInfo.js';
import { ServiceFault } from './DataTypes/ServiceFault.js';

export const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
export const isNode = typeof process !== 'undefined' && process.versions !== undefined && process.versions.node !== undefined;
export const isTest = isNode && process.env.NODE_ENV === 'test';
export const isDevelopment = isNode && process.env.NODE_ENV === 'development';

export function isSByte(value: unknown): value is SByte {
  return typeof value === 'number' && Number.isInteger(value) && value >= -0x80 && value <= 0x7F;
}

export function isByte(value: unknown): value is Byte {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0x00 && value <= 0xFF;
}

export function isInt16(value: unknown): value is Int16 {
  return typeof value === 'number' && Number.isInteger(value) && value >= -0x8000 && value <= 0x7FFF;
}

export function isUInt16(value: unknown): value is UInt16 {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0x00 && value <= 0xFFFF;
}

export function isInt32(value: unknown): value is Int32 {
  return typeof value === 'number' && Number.isInteger(value) && value >= -0x80000000 && value <= 0x7FFFFFFF;
}

export function isUInt32(value: unknown): value is UInt32 {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0x00 && value <= 0xFFFFFFFF;
}

export function isInt64(value: unknown): value is Int64 {
  return typeof value === 'bigint' && value >= BigInt(-1) * BigInt('0x8000000000000000') && value <= BigInt('0x7FFFFFFFFFFFFFFF');
}

export function isUInt64(value: unknown): value is UInt64 {
  return typeof value === 'bigint' && value >= BigInt(0x00) && value <= BigInt('0xFFFFFFFFFFFFFFFF');
}

export function isByteString(value: unknown): value is ByteString {
  return value instanceof Uint8Array || typeof value === 'undefined';
}

export function isUaString(value: unknown): value is UaString {
  return typeof value === 'string' || typeof value === 'undefined';
}

/** Returns the number of 100-nanosecond intervals since January 1, 1601 (UTC). */
export function dateToFileTime(date: Date | number): bigint {
  return (BigInt(+date) + BigInt(11644473600000)) * BigInt(10000);
}

/** Returns the Date of 100-nanosecond intervals since January 1, 1601 (UTC). */
export function fileTimeToDate(filetime: bigint): Date {
  const timestamp = filetime / BigInt(10000) - BigInt(11644473600000);
  return new Date(Number(timestamp));
}

export function isEncodable(value: unknown): value is Encodable {
  return Object(value) === value && encode in (value as Partial<Encodable>);
}

export function isDecodable(value: unknown): value is Decodable {
  return Object(value) === value && decode in (value as Partial<Decodable>);
}

export function isType<T extends Decodable<unknown>>(value: unknown, type: T): value is T {
  return typeof type === 'function' && value instanceof type;
}

export function byteStringToUaString(value: Uint8Array): string
export function byteStringToUaString(value: undefined): undefined
export function byteStringToUaString(value: ByteString): UaString
export function byteStringToUaString(value: ByteString): UaString {
  if (value === undefined) {
    return undefined;
  }
  return new TextDecoder().decode(value);
}

export function uaStringToByteString(value: string): Uint8Array
export function uaStringToByteString(value: undefined): undefined
export function uaStringToByteString(value: UaString): ByteString
export function uaStringToByteString(value: UaString): ByteString {
  if (value === undefined) {
    return undefined;
  }
  return new TextEncoder().encode(value);
}

export function* integerIdGenerator(): Generator<UInt32, UInt32, never> {
  let i = 0;
  while(true) {
    i = (i + 1) % 0xFFFFFFFF;
    if (i === 0) {
      i++;
    }
    yield i;
  }
}

export function getTypeFromTypeId(typeId: NodeIds): DecodableType | undefined {
  switch (typeId) {
    case NodeIds.Guid:
      return Guid;
    case NodeIds.NodeId:
      return NodeId;
    case NodeIds.ExpandedNodeId:
      return ExpandedNodeId;
    case NodeIds.StatusCode:
      return StatusCode;
    case NodeIds.QualifiedName:
      return QualifiedName;
    case NodeIds.LocalizedText:
      return LocalizedText;
    case NodeIds.Structure:
      return ExtensionObject;
    case NodeIds.DataValue:
      return DataValue;
    case NodeIds.BaseDataType:
      return Variant;
    case NodeIds.DiagnosticInfo:
      return DiagnosticInfo;
    case NodeIds.ServiceFault_Encoding_DefaultBinary:
      return ServiceFault;
    default: {
      let name = NodeIds[typeId];
      if (!name || !name.endsWith('_Encoding_DefaultBinary')) {
        return undefined;
      }

      name = name.substring(0, name.length - 23);

      const type = GeneratedTypes[name as keyof typeof GeneratedTypes] as unknown;
      if (!type || !isDecodable(type)) {
        return undefined;
      }
      return type as DecodableType;
    }
  }
}
