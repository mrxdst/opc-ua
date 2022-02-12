import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding.js';
import { UInt16, UInt32 } from './Primitives.js';
import { isUInt16, isUInt32 } from '../util.js';
import { v4 as uuidv4 } from 'uuid';
import { decode, encode, typeId } from '../symbols.js';
import { UaError } from '../UaError.js';
import { StatusCode } from './StatusCode.js';
import { NodeIds } from './NodeIds.js';

export interface GuidOptions {
  data1?: UInt32 | undefined;
  data2?: UInt16 | undefined;
  data3?: UInt16 | undefined;
  data4?: Uint8Array | undefined;
}

/** A Globally Unique Identifier. */
export class Guid implements GuidOptions {
  readonly data1: UInt32;
  readonly data2: UInt16;
  readonly data3: UInt16;
  readonly data4: Uint8Array;

  constructor(options?: GuidOptions) {
    this.data1 = options?.data1 ?? 0;
    this.data2 = options?.data2 ?? 0;
    this.data3 = options?.data3 ?? 0;
    this.data4 = options?.data4 ?? new Uint8Array(8);
  }

  /** Parses the string to a Guid. */
  static parse(str: string): Guid {
    if (!/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/i.test(str)) {
      throw new UaError({code: StatusCode.BadInvalidArgument, reason: 'Invalid guid format'});
    }
    str = str.replace(/-/g, '');
    const data = new Uint8Array(16);
    for (let i = 0; i < str.length; i++) {
      data[i] = (parseInt(str.substring(i * 2, i * 2 + 2), 16));
    }
    const dv = new DataView(data.buffer);
    const data1 = dv.getUint32(0);
    const data2 = dv.getUint16(4);
    const data3 = dv.getUint16(6);
    const data4 = data.subarray(8, 16);
    return new Guid({
      data1,
      data2,
      data3,
      data4
    });
  }

  /** Creates a new random Guid. */
  static new(): Guid {
    return Guid.parse(uuidv4());
  }

  toString(): string {
    if (!isUInt32(this.data1) || !isUInt16(this.data2) || !isUInt16(this.data3) || this.data4.byteLength !== 8) {
      return 'Invalid Guid';
    }
    const part1 = this.data1.toString(16).padStart(8, '0');
    const part2 = this.data2.toString(16).padStart(4, '0');
    const part3 = this.data3.toString(16).padStart(4, '0');
    const part4 = Array.from(this.data4.slice(0, 2)).map(d => d.toString(16).padStart(2, '0')).join('');
    const part5 = Array.from(this.data4.slice(2)).map(d => d.toString(16).padStart(2, '0')).join('');

    return `${part1}-${part2}-${part3}-${part4}-${part5}`.toUpperCase();
  }

  isNull(): boolean {
    return this.data1 === 0 &&
    this.data2 === 0 &&
    this.data3 === 0 &&
    this.data4.reduce((acc, cur) => acc += cur, 0) === 0;
  }

  readonly [typeId] = NodeIds.Guid as const;
  static readonly [typeId] = NodeIds.Guid as const;

  [encode](encoder: BinaryDataEncoder): void {
    if (!isUInt32(this.data1) || !isUInt16(this.data2) || !isUInt16(this.data3) || this.data4.byteLength !== 8) {
      encoder.writeUInt32(0);
      encoder.writeUInt16(0);
      encoder.writeUInt16(0);
      encoder.writeBytes(new Uint8Array(8));
    } else {
      encoder.writeUInt32(this.data1);
      encoder.writeUInt16(this.data2);
      encoder.writeUInt16(this.data3);
      encoder.writeBytes(this.data4);
    }
  }

  static [decode](decoder: BinaryDataDecoder): Guid {
    const options = {
      data1: decoder.readUInt32(),
      data2: decoder.readUInt16(),
      data3: decoder.readUInt16(),
      data4: decoder.readBytes(8)
    };
    return new Guid(options);
  }
}