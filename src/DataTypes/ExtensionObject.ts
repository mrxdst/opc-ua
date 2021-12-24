import { NodeId } from './NodeId';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { ByteString, XmlElement } from './Primitives';
import { decode, encode } from '../symbols';
import { UaError } from '../UaError';
import { StatusCode } from './StatusCode';
import { NodeIds } from './NodeIds';
import { EncodableType } from '../types';
import { typeId } from '../symbols';
import { getTypeFromTypeId } from '../util';

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
  body?: EncodableType | ByteString | XmlElement | undefined;
}

/** A serialized object prefixed with its data type identifier. */
export class ExtensionObject implements ExtensionObjectOptions {
  /**
   * The identifier for the DataTypeEncoding node in the Server’s AddressSpace.
   */
  readonly typeId: NodeId;
  /** The object body. */
  readonly body: EncodableType | ByteString | XmlElement | undefined;

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
      const _typeId = this.body[typeId];
      encoder.writeType(NodeId.parse(_typeId));
      encoder.writeByte(Encoding.ByteString);
      encoder.writeByteString(BinaryDataEncoder.encodeType(this.body));
    }
  }

  static [decode](decoder: BinaryDataDecoder): ExtensionObject {
    const typeId = decoder.readType(NodeId);
    const encoding = decoder.readByte() as Encoding;
    let body: EncodableType | ByteString | XmlElement;

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

    if (body instanceof Uint8Array) {
      try {
        body = decodeBody(typeId, body);
      } catch (e) {
        // Nothing
      }
    }

    return new ExtensionObject({
      typeId,
      body
    });
  }
}

function decodeBody(typeId: NodeId, body: Uint8Array): EncodableType {
  if (typeId.namespace !== 0 || typeof typeId.value !== 'number') {
    throw new UaError({code: StatusCode.BadDecodingError});
  }

  const decodable = getTypeFromTypeId(typeId.value);
  
  if (!decodable) {
    throw new UaError({code: StatusCode.BadDecodingError});
  }

  return BinaryDataDecoder.decodeType<EncodableType>(body, decodable);
}