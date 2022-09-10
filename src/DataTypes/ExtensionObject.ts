import { NodeId } from './NodeId.js';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding.js';
import { ByteString, XmlElement } from './Primitives.js';
import { decode, encode } from '../symbols.js';
import { UaError } from '../UaError.js';
import { StatusCode } from './StatusCode.js';
import { NodeIds } from './NodeIds.js';
import { typeId } from '../symbols.js';

enum Encoding {
  NoBody = 0x00,
  ByteString = 0x01,
  XmlElement = 0x02
}

export interface ExtensionObjectOptions {
  /**
   * The identifier for the DataTypeEncoding node in the Server’s AddressSpace.
   */
  typeId?: NodeId | undefined;
  /** The object body. */
  body?: ByteString | XmlElement | undefined;
}

/** A serialized object prefixed with its data type identifier. */
export class ExtensionObject implements ExtensionObjectOptions {
  /**
   * The identifier for the DataTypeEncoding node in the Server’s AddressSpace.
   */
  readonly typeId: NodeId;
  /** The object body. */
  readonly body: ByteString | XmlElement | undefined;

  constructor(options?: ExtensionObjectOptions) {
    this.typeId = options?.typeId ?? NodeId.null();
    this.body = options?.body;
  }

  toString(): string {
    const str = ['ExtensionObject:'];

    if (this.typeId !== undefined) {
      str.push(`  TypeId: ${this.typeId.toString()}`);
    }
    if (this.body !== undefined) {
      str.push(`  Body: ${this.body.toString()}`);
    }

    return str.join('\n');
  }

  isNull(): boolean {
    return this.typeId.isNull();
  }

  readonly [typeId] = NodeIds.Structure as const;
  static readonly [typeId] = NodeIds.Structure as const;

  [encode](encoder: BinaryDataEncoder): void {
    if (this.body === undefined) {
      encoder.writeType(this.typeId);
      encoder.writeByte(Encoding.NoBody);
    } 
    else if (typeof this.body === 'string') {
      encoder.writeType(this.typeId);
      encoder.writeByte(Encoding.XmlElement);
      encoder.writeXmlElement(this.body);
    } 
    else if (this.body instanceof Uint8Array) {
      encoder.writeType(this.typeId);
      encoder.writeByte(Encoding.ByteString);
      encoder.writeByteString(this.body);
    } 
    else {
      throw new UaError({ code: StatusCode.BadEncodingError, reason: 'Invalid body' });
    }
  }

  static [decode](decoder: BinaryDataDecoder): ExtensionObject {
    const typeId = decoder.readType(NodeId);
    const encoding = decoder.readByte() as Encoding;
    let body: ByteString | XmlElement | undefined;

    switch (encoding) {
      case Encoding.NoBody: {
        break;
      }
      case Encoding.XmlElement: {
        body = decoder.readXmlElement();
        break;
      }
      case Encoding.ByteString: {
        body = decoder.readByteString();
        break;
      }
      default: {
        throw new UaError({code: StatusCode.BadDataEncodingInvalid});
      }
    }

    return new ExtensionObject({
      typeId,
      body
    });
  }
}
