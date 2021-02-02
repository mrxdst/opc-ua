import { Byte, ByteString, Double, Float, Int16, Int32, Int64, SByte, UaString, UInt16, UInt32, UInt64, XmlElement } from './DataTypes/Primitives';
import { StatusCode } from './DataTypes/StatusCode';
import { decode, encode } from './symbols';
import { UaError } from './UaError';
import { dateToFileTime, fileTimeToDate, isSByte, isByte, isInt16, isUInt16, isInt32, isUInt32, isInt64, isUInt64 } from './util';

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

const minFiletime = dateToFileTime(new Date('1601-01-01T00:00:00Z'));
const maxFiletime = dateToFileTime(new Date('9999-12-31T23:59:59Z'));

const encoderInitialSize = 64;
const encoderSizeStep = 64;

export class BinaryDataEncoder {
  #dv: DataView;
  #byteOffset = 0;

  get encodedBytes(): number {
    return this.#byteOffset;
  }

  constructor() {
    this.#dv = new DataView(new ArrayBuffer(encoderInitialSize));
  }

  writeSByte(value: SByte): void {
    if (!isSByte(value)) {
      throw new UaError({code: StatusCode.BadEncodingError, reason: 'Invalid SByte value'});
    }
    const buff = new Uint8Array(DataTypeSize.SByte);
    const dv = new DataView(buff.buffer);
    dv.setInt8(0, value);
    this.writeBytes(buff);
  }

  writeByte(value: Byte): void {
    if (!isByte(value)) {
      throw new UaError({code: StatusCode.BadEncodingError, reason: 'Invalid Byte value'});
    }
    const buff = new Uint8Array(DataTypeSize.Byte);
    const dv = new DataView(buff.buffer);
    dv.setUint8(0, value);
    this.writeBytes(buff);
  }

  writeInt16(value: Int16): void {
    if (!isInt16(value)) {
      throw new UaError({code: StatusCode.BadEncodingError, reason: 'Invalid Int16 value'});
    }
    const buff = new Uint8Array(DataTypeSize.Int16);
    const dv = new DataView(buff.buffer);
    dv.setInt16(0, value, true);
    this.writeBytes(buff);
  }

  writeUInt16(value: UInt16): void {
    if (!isUInt16(value)) {
      throw new UaError({code: StatusCode.BadEncodingError, reason: 'Invalid UInt16 value'});
    }
    const buff = new Uint8Array(DataTypeSize.UInt16);
    const dv = new DataView(buff.buffer);
    dv.setUint16(0, value, true);
    this.writeBytes(buff);
  }

  writeInt32(value: Int32): void {
    if (!isInt32(value)) {
      throw new UaError({code: StatusCode.BadEncodingError, reason: 'Invalid Int32 value'});
    }
    const buff = new Uint8Array(DataTypeSize.Int32);
    const dv = new DataView(buff.buffer);
    dv.setInt32(0, value, true);
    this.writeBytes(buff);
  }

  writeUInt32(value: UInt32): void {
    if (!isUInt32(value)) {
      throw new UaError({code: StatusCode.BadEncodingError, reason: 'Invalid UInt32 value'});
    }
    const buff = new Uint8Array(DataTypeSize.UInt32);
    const dv = new DataView(buff.buffer);
    dv.setUint32(0, value, true);
    this.writeBytes(buff);
  }

  writeInt64(value: Int64): void {
    if (!isInt64(value)) {
      throw new UaError({code: StatusCode.BadEncodingError, reason: 'Invalid Int64 value'});
    }
    const buff = new Uint8Array(DataTypeSize.Int64);
    const dv = new DataView(buff.buffer);
    dv.setBigInt64(0, value, true);
    this.writeBytes(buff);
  }

  writeUInt64(value: UInt64): void {
    if (!isUInt64(value)) {
      throw new UaError({code: StatusCode.BadEncodingError, reason: 'Invalid UInt64 value'});
    }
    const buff = new Uint8Array(DataTypeSize.UInt64);
    const dv = new DataView(buff.buffer);
    dv.setBigUint64(0, value, true);
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
    if (this.#dv.byteLength < this.#byteOffset + value.byteLength) {
      const old = new Uint8Array(this.#dv.buffer, this.#dv.byteOffset, this.#dv.byteLength);
      const _new = new Uint8Array(this.#dv.byteLength + Math.ceil(value.byteLength / encoderSizeStep) * encoderSizeStep);
      _new.set(old);
      _new.set(value, this.#byteOffset);
      this.#dv = new DataView(_new.buffer);
    }

    const data = new Uint8Array(this.#dv.buffer, this.#dv.byteOffset, this.#dv.byteLength);
    data.set(value, this.#byteOffset);
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
    if (isNaN(value.getTime())) {
      throw new UaError({code: StatusCode.BadEncodingError, reason: 'Invalid DateTime'});
    }
    let filetime = dateToFileTime(value);
    if (filetime < minFiletime || filetime >= maxFiletime) {
      filetime = BigInt(0);
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
    return new Uint8Array(this.#dv.buffer, 0, this.#byteOffset);
  }

  static encodeSByte(value: SByte): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeSByte(value);
    return encoder.finish();
  }

  static encodeByte(value: Byte): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeByte(value);
    return encoder.finish();
  }

  static encodeInt16(value: Int16): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeInt16(value);
    return encoder.finish();
  }

  static encodeUInt16(value: UInt16): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeUInt16(value);
    return encoder.finish();
  }

  static encodeInt32(value: Int32): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeInt32(value);
    return encoder.finish();
  }

  static encodeUInt32(value: UInt32): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeUInt32(value);
    return encoder.finish();
  }

  static encodeInt64(value: Int64): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeInt64(value);
    return encoder.finish();
  }

  static encodeUInt64(value: UInt64): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeUInt64(value);
    return encoder.finish();
  }

  static encodeFloat(value: Float): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeFloat(value);
    return encoder.finish();
  }

  static encodeDouble(value: Double): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeDouble(value);
    return encoder.finish();
  }

  static encodeBytes(value: Uint8Array): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeBytes(value);
    return encoder.finish();
  }

  static encodeBoolean(value: boolean): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeBoolean(value);
    return encoder.finish();
  }

  static encodeByteString(value: ByteString): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeByteString(value);
    return encoder.finish();
  }

  static encodeString(value: UaString): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeString(value);
    return encoder.finish();
  }

  static encodeStringBytes(value: string): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeFixedLengthString(value);
    return encoder.finish();
  }

  static encodeDateTime(value: Date): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeDateTime(value);
    return encoder.finish();
  }

  static encodeXmlElement(value: XmlElement): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeXmlElement(value);
    return encoder.finish();
  }

  static encodeType(value: Encodable): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeType(value);
    return encoder.finish();
  }

  static encodeSByteArray(values: SByte[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeSByteArray(values);
    return encoder.finish();
  }

  static encodeByteArray(values: Byte[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeByteArray(values);
    return encoder.finish();
  }

  static encodeInt16Array(values: Int16[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeInt16Array(values);
    return encoder.finish();
  }

  static encodeUInt16Array(values: UInt16[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeUInt16Array(values);
    return encoder.finish();
  }

  static encodeInt32Array(values: Int32[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeInt32Array(values);
    return encoder.finish();
  }

  static encodeUInt32Array(values: UInt32[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeUInt32Array(values);
    return encoder.finish();
  }

  static encodeInt64Array(values: Int64[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeInt64Array(values);
    return encoder.finish();
  }

  static encodeUInt64Array(values: UInt64[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeUInt64Array(values);
    return encoder.finish();
  }

  static encodeFloatArray(values: Float[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeFloatArray(values);
    return encoder.finish();
  }

  static encodeDoubleArray(values: Double[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeDoubleArray(values);
    return encoder.finish();
  }

  static encodeBooleanArray(values: boolean[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeBooleanArray(values);
    return encoder.finish();
  }

  static encodeByteStringArray(values: ByteString[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeByteStringArray(values);
    return encoder.finish();
  }

  static encodeStringArray(values: UaString[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeStringArray(values);
    return encoder.finish();
  }

  static encodeDateTimeArray(values: Date[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeDateTimeArray(values);
    return encoder.finish();
  }

  static encodeXmlElementArray(values: XmlElement[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeXmlElementArray(values);
    return encoder.finish();
  }

  static encodeTypeArray(values: Encodable[] | undefined): Uint8Array {
    const encoder = new BinaryDataEncoder();
    encoder.writeTypeArray(values);
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

  static decodeSByte(data: Uint8Array): SByte {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readSByte();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeByte(data: Uint8Array): Byte {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readByte();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeInt16(data: Uint8Array): Int16 {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readInt16();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeUInt16(data: Uint8Array): UInt16 {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readUInt16();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeInt32(data: Uint8Array): Int32 {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readInt32();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeUInt32(data: Uint8Array): UInt32 {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readUInt32();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeInt64(data: Uint8Array): Int64 {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readInt64();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeUInt64(data: Uint8Array): UInt64 {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readUInt64();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeFloat(data: Uint8Array): Float {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readFloat();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeDouble(data: Uint8Array): Double {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readDouble();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeBytes(data: Uint8Array, byteLength: number): Uint8Array {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readBytes(byteLength);
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeBoolean(data: Uint8Array): boolean {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readBoolean();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeByteString(data: Uint8Array): ByteString {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readByteString();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeString(data: Uint8Array): UaString {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readString();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeStringBytes(data: Uint8Array, byteLength: number): string {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readFixedLengthString(byteLength);
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeDateTime(data: Uint8Array): Date {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readDateTime();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeXmlElement(data: Uint8Array): XmlElement {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readXmlElement();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeType<T>(data: Uint8Array, type: Decodable<T>): T {
    const decoder = new BinaryDataDecoder(data);
    const value = decoder.readType(type);
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return value;
  }

  static decodeSByteArray(data: Uint8Array): SByte[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readSByteArray();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeByteArray(data: Uint8Array): Byte[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readByteArray();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeInt16Array(data: Uint8Array): Int16[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readInt16Array();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeUInt16Array(data: Uint8Array): UInt16[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readUInt16Array();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeInt32Array(data: Uint8Array): Int32[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readInt32Array();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeUInt32Array(data: Uint8Array): UInt32[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readUInt32Array();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeInt64Array(data: Uint8Array): Int64[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readInt64Array();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeUInt64Array(data: Uint8Array): UInt64[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readUInt64Array();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeFloatArray(data: Uint8Array): Float[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readFloatArray();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeDoubleArray(data: Uint8Array): Double[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readDoubleArray();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeBooleanArray(data: Uint8Array): boolean[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readBooleanArray();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeByteStringArray(data: Uint8Array): ByteString[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readByteStringArray();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeStringArray(data: Uint8Array): UaString[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readStringArray();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeDateTimeArray(data: Uint8Array): Date[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readDateTimeArray();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeXmlElementArray(data: Uint8Array): XmlElement[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readXmlElementArray();
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }

  static decodeTypeArray<T>(data: Uint8Array, type: Decodable<T>): T[] | undefined {
    const decoder = new BinaryDataDecoder(data);
    const values = decoder.readTypeArray(type);
    if (decoder.bytesLeft) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid byte length'});
    }
    return values;
  }
}
