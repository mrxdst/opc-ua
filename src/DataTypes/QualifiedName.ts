import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { decode, encode, typeId } from '../symbols';
import { UaError } from '../UaError';
import { isUInt16 } from '../util';
import { NodeIds } from './NodeIds';
import { UaString, UInt16 } from './Primitives';
import { StatusCode } from './StatusCode';

export interface QualifiedNameOptions {
  /** The namespace index. */
  namespaceIndex?: UInt16;
  /** The name. */
  name?: UaString;
}

/** A string qualified with a namespace index. */
export class QualifiedName implements QualifiedName {
  /** The namespace index. */
  namespaceIndex: UInt16;
  /** The name. */
  name?: UaString;

  constructor(options?: QualifiedNameOptions) {
    this.namespaceIndex = options?.namespaceIndex ?? 0;
    this.name = options?.name;
  }

  toString(): string {
    if (!isUInt16(this.namespaceIndex)) {
      return 'Invalid QualifiedName';
    }
    if (this.namespaceIndex === 0) {
      return this.name ?? '';
    }
    return `${this.namespaceIndex}:${this.name ?? ''}`;
  }

  isNull(): boolean {
    return this.namespaceIndex === 0 && this.name === undefined;
  }

  /** Parses the string to a QualifiedName. */
  static parse(str: string): QualifiedName {
    let namespaceIndex = 0;
    let name = str;
    const match = /^(\d+):(.*)$/.exec(str);
    if (match) {
      const _namespaceIndex = parseInt(match[1] as string);
      if (isUInt16(_namespaceIndex)) {
        namespaceIndex = _namespaceIndex;
        name = match[2] as string;
      }
    }
    if (name.length > 512) {
      throw new UaError({code: StatusCode.BadOutOfRange, reason: 'Name too long'});
    }
    return new QualifiedName({
      namespaceIndex,
      name
    });
  }

  static [typeId] = NodeIds.QualifiedName as const;

  [encode](encoder: BinaryDataEncoder): void {
    encoder.writeUInt16(this.namespaceIndex);
    let name = this.name;
    if (name && name.length > 512) {
      name = name.substring(0, 512);
    }
    encoder.writeString(name);
  }

  static [decode](decoder: BinaryDataDecoder): QualifiedName {
    const namespaceIndex = decoder.readUInt16();
    const name = decoder.readString();
    return new QualifiedName({namespaceIndex, name});
  }
}
