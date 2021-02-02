import { TypedArray } from './types';
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
} from './DataTypes/Primitives';

export const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
export const isNode = typeof process !== 'undefined' && process.versions !== undefined && process.versions.node !== undefined;
export const isTest = isNode && process.env.NODE_ENV === 'test';
export const isDevelopment = isNode && process.env.NODE_ENV === 'development';

export function clampSByte(value: number): SByte {
  return clampInteger(value, -0x80, 0x7F);
}

export function clampByte(value: number): Byte {
  return clampInteger(value, 0x00, 0xFF);
}

export function clampInt16(value: number): Int16 {
  return clampInteger(value, -0x8000, 0x7FFF);
}

export function clampUInt16(value: number): UInt16 {
  return clampInteger(value, 0x00, 0xFFFF);
}

export function clampInt32(value: number): Int32 {
  return clampInteger(value, -0x80000000, 0x7FFFFFFF);
}

export function clampUInt32(value: number): UInt32 {
  return clampInteger(value, 0x00, 0xFFFFFFFF);
}

export function clampInt64(value: bigint): Int64 {
  return clampBigInteger(value, BigInt(-1) * BigInt('0x8000000000000000'), BigInt('0x7FFFFFFFFFFFFFFF'));
}

export function clampUInt64(value: bigint): UInt64 {
  return clampBigInteger(value, BigInt(0), BigInt('0xFFFFFFFFFFFFFFFF'));
}

export function clampInteger(value: number, min: number, max: number): number {
  if (isNaN(value)) {
    return 0;
  }
  return Math.min(Math.max(Math.floor(value), min), max);
}

export function clampBigInteger(value: bigint, min: bigint, max: bigint): bigint {
  if (value > max) {
    return max;
  } else if (value < min) {
    return min;
  }
  return value;
}

export function isSByte(value: number): boolean {
  return value === clampSByte(value);
}

export function isByte(value: number): boolean {
  return value === clampByte(value);
}

export function isInt16(value: number): boolean {
  return value === clampInt16(value);
}

export function isUInt16(value: number): boolean {
  return value === clampUInt16(value);
}

export function isInt32(value: number): boolean {
  return value === clampInt32(value);
}

export function isUInt32(value: number): boolean {
  return value === clampUInt32(value);
}

export function isInt64(value: bigint): boolean {
  return value === clampInt64(value);
}

export function isUInt64(value: bigint): boolean {
  return value === clampUInt64(value);
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

export function setTimeoutAsync(timeout?: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeout));
}