import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { decode, encode } from '../symbols';
import { UaError } from '../UaError';
import { clampInteger } from '../util';
import { UInt16 } from './Primitives';
import { StatusCode } from './StatusCode';
import { Variant } from './Variant';

const valueMask = 0x01;
const statusCodeMask = 0x02;
const sourceTimestampMask = 0x04;
const serverTimestampMask = 0x08;
const sourcePicoSecondsMask = 0x10;
const serverPicoSecondsMask = 0x20;

export interface DataValueOptions {
  /** The value. */
  value?: Variant;
  /** The status associated with the value. */
  status?: StatusCode;
  /** The source timestamp associated with the value. */
  sourceTimestamp?: Date;
  /** The number of 10 picosecond intervals for the SourceTimestamp. */
  sourcePicoSeconds?: UInt16;
  /** The Server timestamp associated with the value. */
  serverTimestamp?: Date;
  /** The number of 10 picosecond intervals for the ServerTimestamp. */
  serverPicoSeconds?: UInt16;
}

/** A value with an associated timestamp, and quality. */
export class DataValue implements DataValueOptions {
  /** The value. */
  value?: Variant;
  /** The status associated with the value. */
  status?: StatusCode;
  /** The source timestamp associated with the value. */
  sourceTimestamp?: Date;
  /** The number of 10 picosecond intervals for the SourceTimestamp. */
  sourcePicoSeconds?: UInt16;
  /** The Server timestamp associated with the value. */
  serverTimestamp?: Date;
  /** The number of 10 picosecond intervals for the ServerTimestamp. */
  serverPicoSeconds?: UInt16;

  constructor(options?: DataValueOptions) {
    this.value = options?.value;
    this.status = options?.status;
    this.sourceTimestamp = options?.sourceTimestamp;
    this.sourcePicoSeconds = options?.sourcePicoSeconds;
    this.serverTimestamp = options?.serverTimestamp;
    this.serverPicoSeconds = options?.serverPicoSeconds;
  }

  toString(): string {
    const str = ['DataValue:'];

    if (this.value !== undefined) {
      str.push(`  Value: ${this.value.toString()}`);
    }
    if (this.status !== undefined) {
      str.push(`  Status: ${this.status.toString()}`);
    }
    if (this.sourceTimestamp !== undefined) {
      str.push(`  SourceTimestamp: ${this.sourceTimestamp.toUTCString()}`);
    }
    if (this.sourcePicoSeconds !== undefined) {
      let _str = this.sourcePicoSeconds.toString();
      if (this.sourcePicoSeconds !== clampInteger(this.sourcePicoSeconds, 0, 9999)) {
        _str += ' (Invalid)';
      }
      str.push(`  SourcePicoSeconds: ${_str}`);
    }
    if (this.serverTimestamp !== undefined) {
      str.push(`  ServerTimestamp: ${this.serverTimestamp.toUTCString()}`);
    }
    if (this.serverPicoSeconds !== undefined) {
      let _str = this.serverPicoSeconds.toString();
      if (this.serverPicoSeconds !== clampInteger(this.serverPicoSeconds, 0, 9999)) {
        _str += ' (Invalid)';
      }
      str.push(`  ServerPicoSeconds: ${_str}`);
    }

    return str.join('\n');
  }

  isNull(): boolean {
    return this.value === undefined &&
    this.status === undefined &&
    this.sourceTimestamp === undefined &&
    this.sourcePicoSeconds === undefined &&
    this.serverTimestamp === undefined &&
    this.serverPicoSeconds === undefined;
  }

  [encode](encoder: BinaryDataEncoder): void {
    let encodingMask = 0;
    if (this.value !== undefined) {
      encodingMask |= valueMask;
    }
    if (this.status) {
      encodingMask |= statusCodeMask;
    }
    if (this.sourceTimestamp !== undefined) {
      encodingMask |= sourceTimestampMask;
    }
    if (this.serverTimestamp !== undefined) {
      encodingMask |= serverTimestampMask;
    }
    if (this.sourcePicoSeconds) {
      encodingMask |= sourcePicoSecondsMask;
    }
    if (this.serverPicoSeconds) {
      encodingMask |= serverPicoSecondsMask;
    }

    encoder.writeByte(encodingMask);

    if (this.value !== undefined) {
      encoder.writeType(this.value);
    }
    if (this.status) {
      encoder.writeType(this.status);
    }
    if (this.sourceTimestamp !== undefined) {
      encoder.writeDateTime(this.sourceTimestamp);
    }
    if (this.serverTimestamp !== undefined) {
      encoder.writeDateTime(this.serverTimestamp);
    }
    if (this.sourcePicoSeconds) {
      if (this.sourcePicoSeconds !== clampInteger(this.sourcePicoSeconds, 0, 9999)) {
        throw new UaError({code: StatusCode.BadOutOfRange, reason: 'Invalid SourcePicoSeconds value'});
      }
      encoder.writeUInt16(this.sourcePicoSeconds);
    }
    if (this.serverPicoSeconds) {
      if (this.serverPicoSeconds !== clampInteger(this.serverPicoSeconds, 0, 9999)) {
        throw new UaError({code: StatusCode.BadOutOfRange, reason: 'Invalid ServerPicoSeconds value'});
      }
      encoder.writeUInt16(this.serverPicoSeconds);
    }
  }

  static [decode](decoder: BinaryDataDecoder): DataValue {
    const encodingMask = decoder.readByte();
    let value: Variant | undefined;
    let status: StatusCode | undefined;
    let sourceTimestamp: Date | undefined;
    let sourcePicoSeconds: UInt16 | undefined;
    let serverTimestamp: Date | undefined;
    let serverPicoSeconds: UInt16 | undefined;
    
    if (encodingMask & valueMask) {
      value = decoder.readType(Variant);
    }
    if (encodingMask & statusCodeMask) {
      status = decoder.readType(StatusCode);
    }
    if (encodingMask & sourceTimestampMask) {
      sourceTimestamp = decoder.readDateTime();
    }
    if (encodingMask & serverTimestampMask) {
      serverTimestamp = decoder.readDateTime();
    }
    if (encodingMask & sourcePicoSecondsMask) {
      sourcePicoSeconds = decoder.readUInt16();
    }
    if (encodingMask & serverPicoSecondsMask) {
      serverPicoSeconds = decoder.readUInt16();
    }

    return new DataValue({
      value,
      status,
      sourceTimestamp,
      serverTimestamp,
      sourcePicoSeconds,
      serverPicoSeconds
    });
  }
}