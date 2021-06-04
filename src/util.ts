import { DecodableType, TypedArray } from './types';
import { NdArray } from 'ndarray';
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
  UaString,
  Float,
  Double
} from './DataTypes/Primitives';
import * as GeneratedTypes from './DataTypes/Generated';
import { decode, encode } from './symbols';
import { Decodable, Encodable } from './BinaryDataEncoding';
import { NodeIds } from './DataTypes/NodeIds';
import { Guid } from './DataTypes/Guid';
import { NodeId } from './DataTypes/NodeId';
import { ExpandedNodeId } from './DataTypes/ExpandedNodeId';
import { StatusCode } from './DataTypes/StatusCode';
import { QualifiedName } from './DataTypes/QualifiedName';
import { LocalizedText } from './DataTypes/LocalizedText';
import { ExtensionObject } from './DataTypes/ExtensionObject';
import { DataValue } from './DataTypes/DataValue';
import { Variant } from './DataTypes/Variant';
import { DiagnosticInfo } from './DataTypes/DiagnosticInfo';
import { ServiceFault } from './DataTypes/ServiceFault';

export const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
export const isNode = typeof process !== 'undefined' && process.versions !== undefined && process.versions.node !== undefined;
export const isTest = isNode && process.env.NODE_ENV === 'test';
export const isDevelopment = isNode && process.env.NODE_ENV === 'development';

export function clampSByte(value: unknown): SByte {
  return clampInteger(value, -0x80, 0x7F);
}

export function clampByte(value: unknown): Byte {
  return clampInteger(value, 0x00, 0xFF);
}

export function clampInt16(value: unknown): Int16 {
  return clampInteger(value, -0x8000, 0x7FFF);
}

export function clampUInt16(value: unknown): UInt16 {
  return clampInteger(value, 0x00, 0xFFFF);
}

export function clampInt32(value: unknown): Int32 {
  return clampInteger(value, -0x80000000, 0x7FFFFFFF);
}

export function clampUInt32(value: unknown): UInt32 {
  return clampInteger(value, 0x00, 0xFFFFFFFF);
}

export function clampInt64(value: unknown): Int64 {
  return clampBigInteger(value, BigInt(-1) * BigInt('0x8000000000000000'), BigInt('0x7FFFFFFFFFFFFFFF'));
}

export function clampUInt64(value: unknown): UInt64 {
  return clampBigInteger(value, BigInt(0), BigInt('0xFFFFFFFFFFFFFFFF'));
}

export function clampInteger(value: unknown, min: number, max: number): number {
  let val = Number(value);
  if (isNaN(val)) {
    if (min > 0) {
      return min;
    } else if (max < 0) {
      return max;
    }
    return 0;
  }
  val = Math.floor(val);
  if (val > max) {
    return max;
  } else if (val < min) {
    return min;
  }
  return val;
}

export function clampBigInteger(value: unknown, min: bigint, max: bigint): bigint {
  let val: bigint;
  if (typeof value === 'bigint') {
    val = value;
  } else if (typeof value === 'string') {
    try {
      val = BigInt(value);
    } catch (e) {
      val = BigInt(0);
    }
  } else {
    val = BigInt(0);
  }

  if (val > max) {
    return max;
  } else if (val < min) {
    return min;
  }
  return val;
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isSByte(value: unknown): value is SByte {
  return typeof value === 'number' && value === clampSByte(value);
}

export function isByte(value: unknown): value is Byte {
  return typeof value === 'number' && value === clampByte(value);
}

export function isInt16(value: unknown): value is Int16 {
  return typeof value === 'number' && value === clampInt16(value);
}

export function isUInt16(value: unknown): value is UInt16 {
  return typeof value === 'number' && value === clampUInt16(value);
}

export function isInt32(value: unknown): value is Int32 {
  return typeof value === 'number' && value === clampInt32(value);
}

export function isUInt32(value: unknown): value is UInt32 {
  return typeof value === 'number' && value === clampUInt32(value);
}

export function isInt64(value: unknown): value is Int64 {
  return typeof value === 'bigint' && value === clampInt64(value);
}

export function isUInt64(value: unknown): value is UInt64 {
  return typeof value === 'bigint' && value === clampUInt64(value);
}

export function isFloat(value: unknown): value is Float {
  return typeof value === 'number';
}

export function isDouble(value: unknown): value is Double {
  return typeof value === 'number';
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

export function isTypedArray(obj: unknown): obj is TypedArray {
  return obj instanceof Int8Array ||
    obj instanceof Uint8Array ||
    obj instanceof Int16Array ||
    obj instanceof Uint16Array ||
    obj instanceof Int32Array ||
    obj instanceof Uint32Array ||
    obj instanceof Uint8ClampedArray ||
    obj instanceof Float32Array ||
    obj instanceof Float64Array;
}

export function isNdArray<T>(obj: unknown): obj is NdArray<T> {
  return new Object(obj) === obj
    && 'data' in obj
    && 'shape' in obj
    && 'stride' in obj
    && 'offset' in obj;
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
    case NodeIds.ServiceFault:
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

export function setTimeoutAsync(timeout?: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeout));
}