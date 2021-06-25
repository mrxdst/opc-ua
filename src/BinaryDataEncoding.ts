import { Byte, ByteString, Double, Float, Int16, Int32, Int64, SByte, UaString, UInt16, UInt32, UInt64, XmlElement } from './DataTypes/Primitives';
import { StatusCode } from './DataTypes/StatusCode';
import { decode, encode } from './symbols';
import { UaError } from './UaError';
import { dateToFileTime, fileTimeToDate, clampSByte, clampByte, clampInt16, clampUInt16, clampInt32, clampUInt32, clampInt64, clampUInt64 } from './util';

enum DataTypeSize {
  SByte = 1,
  Byte = 1,
  Int16 = 2,
  UInt16 = 2,
  Int32 = 4,
  UInt32 = 4,
  Int64 = 8,
  UInt64 = 8,
  Float = 4,
  Double = 8
}

export interface Encodable {
  [encode]: (encoder: BinaryDataEncoder) => void;
}

export interface Decodable<T = unknown> {
  [decode]: (decoder: BinaryDataDecoder) => T;
}

const minFiletime = BigInt(0);
const maxFiletime = BigInt('2650467743990000000');

const encoderInitialSize = 64;

export class BinaryDataEncoder {
  #buff: Uint8Array;
  #byteOffset = 0;

  get encodedBytes(): number {
    return this.#byteOffset;
  }

  constructor() {
    this.#buff = new Uint8Array(encoderInitialSize);
  }

  writeSByte(value: SByte): void {
    const buff = new Uint8Array(DataTypeSize.SByte);
    const dv = new DataView(buff.buffer);
    dv.setInt8(0, clampSByte(value));
    this.writeBytes(buff);
  }

  writeByte(value: Byte): void {
    const buff = new Uint8Array(DataTypeSize.Byte);
    const dv = new DataView(buff.buffer);
    dv.setUint8(0, clampByte(value));
    this.writeBytes(buff);
  }

  writeInt16(value: Int16): void {
    const buff = new Uint8Array(DataTypeSize.Int16);
    const dv = new DataView(buff.buffer);
    dv.setInt16(0, clampInt16(value), true);
    this.writeBytes(buff);
  }

  writeUInt16(value: UInt16): void {
    const buff = new Uint8Array(DataTypeSize.UInt16);
    const dv = new DataView(buff.buffer);
    dv.setUint16(0, clampUInt16(value), true);
    this.writeBytes(buff);
  }

  writeInt32(value: Int32): void {
    const buff = new Uint8Array(DataTypeSize.Int32);
    const dv = new DataView(buff.buffer);
    dv.setInt32(0, clampInt32(value), true);
    this.writeBytes(buff);
  }

  writeUInt32(value: UInt32): void {
    const buff = new Uint8Array(DataTypeSize.UInt32);
    const dv = new DataView(buff.buffer);
    dv.setUint32(0, clampUInt32(value), true);
    this.writeBytes(buff);
  }

  writeInt64(value: Int64): void {
    const buff = new Uint8Array(DataTypeSize.Int64);
    const dv = new DataView(buff.buffer);
    dv.setBigInt64(0, clampInt64(value), true);
    this.writeBytes(buff);
  }

  writeUInt64(value: UInt64): void {
    const buff = new Uint8Array(DataTypeSize.UInt64);
    const dv = new DataView(buff.buffer);
    dv.setBigUint64(0, clampUInt64(value), true);
    this.writeBytes(buff);
  }

  writeFloat(value: Float): void {
    const buff = new Uint8Array(DataTypeSize.Float);
    const dv = new DataView(buff.buffer);
    dv.setFloat32(0, value, true);
    this.writeBytes(buff);
  }

  writeDouble(value: Double): void {
    const buff = new Uint8Array(DataTypeSize.Double);
    const dv = new DataView(buff.buffer);
    dv.setFloat64(0, value, true);
    this.writeBytes(buff);
  }

  writeBytes(value: Uint8Array): void {
    if (this.#buff.byteLength < this.#byteOffset + value.byteLength) {
      let newSize = this.#buff.byteLength;
      do {
        newSize *= 2;
      } while (newSize < this.#byteOffset + value.byteLength);
      const _new = new Uint8Array(newSize);
      _new.set(this.#buff);
      this.#buff = _new;
    }

    this.#buff.set(value, this.#byteOffset);
    this.#byteOffset += value.byteLength;
  }

  writeBoolean(value: boolean): void {
    this.writeByte(value ? 1 : 0);
  }

  writeByteString(value: ByteString): void {
    if (value === undefined) {
      this.writeInt32(-1);
      return;
    }
    this.writeInt32(value.byteLength);
    this.writeBytes(value);
  }

  writeString(value: UaString): void {
    const bytes = value !== undefined ? new TextEncoder().encode(value) : undefined;
    this.writeByteString(bytes);
  }

  writeFixedLengthString(value: string): void {
    const bytes = new TextEncoder().encode(value);
    this.writeBytes(bytes);
  }

  writeDateTime(value: Date): void {
    let filetime: bigint;
    if (!(value instanceof Date) || isNaN(value.getTime())) {
      filetime = BigInt(0);
    } else {
      filetime = dateToFileTime(value);
      if (filetime < minFiletime || filetime >= maxFiletime) {
        filetime = BigInt(0);
      }
    }
    this.writeInt64(filetime);
  }

  writeXmlElement(value: XmlElement): void {
    this.writeString(value);
  }

  writeType(value: Encodable): void {
    value[encode](this);
  }

  writeSByteArray(values: SByte[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeSByte(values[i] as SByte);
      }
    }
  }

  writeByteArray(values: Byte[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeByte(values[i] as Byte);
      }
    }
  }

  writeInt16Array(values: Int16[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeInt16(values[i] as Int16);
      }
    }
  }

  writeUInt16Array(values: UInt16[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeUInt16(values[i] as UInt16);
      }
    }
  }

  writeInt32Array(values: Int32[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeInt32(values[i] as Int32);
      }
    }
  }

  writeUInt32Array(values: UInt32[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeUInt32(values[i] as UInt32);
      }
    }
  }

  writeInt64Array(values: Int64[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeInt64(values[i] as Int64);
      }
    }
  }

  writeUInt64Array(values: UInt64[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeUInt64(values[i] as UInt64);
      }
    }
  }

  writeFloatArray(values: Float[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeFloat(values[i] as Float);
      }
    }
  }

  writeDoubleArray(values: Double[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeDouble(values[i] as Double);
      }
    }
  }

  writeBooleanArray(values: boolean[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeBoolean(values[i] as boolean);
      }
    }
  }

  writeByteStringArray(values: ByteString[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeByteString(values[i]);
      }
    }
  }

  writeStringArray(values: UaString[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeString(values[i]);
      }
    }
  }

  writeDateTimeArray(values: Date[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeDateTime(values[i] as Date);
      }
    }
  }

  writeXmlElementArray(values: XmlElement[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeXmlElement(values[i]);
      }
    }
  }

  writeTypeArray(values: Encodable[] | undefined): void {
    this.writeInt32(values ? values.length : -1);
    if (values) {
      for (let i = 0; i < values.length; i++) {
        this.writeType(values[i] as Encodable);
      }
    }
  }

  finish(): Uint8Array {
    return new Uint8Array(this.#buff.buffer, 0, this.#byteOffset);
  }

  static encodeType(value: Encodable): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeType(value);
    return encoder.finish();
  }
}

export class BinaryDataDecoder {
  #dv: DataView;
  #byteOffset = 0;

  get decodedBytes(): number {
    return this.#byteOffset;
  }

  get bytesLeft(): number {
    return this.#dv.byteLength - this.#byteOffset;
  }

  constructor(value: Uint8Array) {
    this.#dv = new DataView(value.buffer, value.byteOffset, value.byteLength);
  }

  readSByte(): SByte {
    const value = this.#dv.getInt8(this.#byteOffset);
    this.#byteOffset += DataTypeSize.SByte;
    return value;
  }

  readByte(): Byte {
    const value = this.#dv.getUint8(this.#byteOffset);
    this.#byteOffset += DataTypeSize.Byte;
    return value;
  }

  readInt16(): Int16 {
    const value = this.#dv.getInt16(this.#byteOffset, true);
    this.#byteOffset += DataTypeSize.Int16;
    return value;
  }

  readUInt16(): UInt16 {
    const value = this.#dv.getUint16(this.#byteOffset, true);
    this.#byteOffset += DataTypeSize.UInt16;
    return value;
  }
  
  readInt32(): Int32 {
    const value = this.#dv.getInt32(this.#byteOffset, true);
    this.#byteOffset += DataTypeSize.Int32;
    return value;
  }

  readUInt32(): UInt32 {
    const value = this.#dv.getUint32(this.#byteOffset, true);
    this.#byteOffset += DataTypeSize.UInt32;
    return value;
  }

  readInt64(): Int64 {
    const value = this.#dv.getBigInt64(this.#byteOffset, true);
    this.#byteOffset += DataTypeSize.Int64;
    return value;
  }

  readUInt64(): UInt64 {
    const value = this.#dv.getBigUint64(this.#byteOffset, true);
    this.#byteOffset += DataTypeSize.UInt64;
    return value;
  }

  readFloat(): Float {
    const value = this.#dv.getFloat32(this.#byteOffset, true);
    this.#byteOffset += DataTypeSize.Float;
    return value;
  }

  readDouble(): Double {
    const value = this.#dv.getFloat64(this.#byteOffset, true);
    this.#byteOffset += DataTypeSize.Double;
    return value;
  }

  readBytes(byteLength: number): Uint8Array {
    const bytes =  new Uint8Array(this.#dv.buffer, this.#dv.byteOffset + this.#byteOffset, byteLength);
    this.#byteOffset += bytes.byteLength;
    return bytes;
  }

  readBoolean(): boolean {
    return this.readByte() !== 0;
  }

  readByteString(): ByteString {
    const n = this.readInt32();
    if (n < 0) {
      return undefined;
    }
    return this.readBytes(n);
  }

  readString(): UaString {
    const bytes = this.readByteString();
    if (!bytes) {
      return undefined;
    }
    return new TextDecoder().decode(bytes);
  }

  readFixedLengthString(byteLength: number): string {
    const bytes = this.readBytes(byteLength);
    return new TextDecoder().decode(bytes);
  }

  readDateTime(): Date {
    const value = this.readInt64();
    return fileTimeToDate(value);
  }

  readXmlElement(): XmlElement {
    return this.readString();
  }

  readType<T>(type: Decodable<T>): T {
    const data = type[decode](this);
    return data;
  }

  readSByteArray(): SByte[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: SByte[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readSByte());
    }
    return values;
  }

  readByteArray(): Byte[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: Byte[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readByte());
    }
    return values;
  }

  readInt16Array(): Int16[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: Int16[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readInt16());
    }
    return values;
  }

  readUInt16Array(): UInt16[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: UInt16[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readUInt16());
    }
    return values;
  }

  readInt32Array(): Int32[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: Int32[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readInt32());
    }
    return values;
  }

  readUInt32Array(): UInt32[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: UInt32[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readUInt32());
    }
    return values;
  }

  readInt64Array(): Int64[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: Int64[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readInt64());
    }
    return values;
  }

  readUInt64Array(): UInt64[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: UInt64[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readUInt64());
    }
    return values;
  }

  readFloatArray(): Float[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: Float[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readFloat());
    }
    return values;
  }

  readDoubleArray(): Double[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: Double[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readDouble());
    }
    return values;
  }

  readBooleanArray(): boolean[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: boolean[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readBoolean());
    }
    return values;
  }

  readByteStringArray(): ByteString[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: ByteString[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readByteString());
    }
    return values;
  }

  readStringArray(): UaString[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: UaString[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readString());
    }
    return values;
  }

  readDateTimeArray(): Date[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: Date[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readDateTime());
    }
    return values;
  }

  readXmlElementArray(): XmlElement[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: XmlElement[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readXmlElement());
    }
    return values;
  }

  readTypeArray<T>(type: Decodable<T>): T[] | undefined {
    const length = this.readInt32();
    if (length < 0) {
      return undefined;
    }
    const values: T[] = [];
    for (let i = 0; i < length; i++) {
      values.push(this.readType(type));
    }
    return values;
  }

  static decodeType<T>(data: Uint8Array, type: Decodable<T>): T {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readType(type);
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }
}
