import { NodeId } from './NodeId';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { ByteString, XmlElement } from './Primitives';
import { decode, encode } from '../symbols';
import { UaError } from '../UaError';
import { StatusCode } from './StatusCode';
import { NodeIds } from './NodeIds';
import { DecodableType, EncodableType } from '../types';
import { ServiceFault } from './ServiceFault';
import * as GeneratedTypes from './Generated';
import { typeId } from '../symbols';

enum Encoding {
  NoBody = 0x00,
  ByteString = 0x01,
  XmlElement = 0x02
}

export interface ExtensionObjectOptions {
  /**
   * The identifier for the DataTypeEncoding node in the Server’s AddressSpace.
   */
  typeId?: NodeId;
  /** The object body. */
  body?: EncodableType | ByteString | XmlElement;
}

/** A serialized object prefixed with its data type identifier. */
export class ExtensionObject implements ExtensionObjectOptions {
  /**
   * The identifier for the DataTypeEncoding node in the Server’s AddressSpace.
   */
  typeId: NodeId;
  /** The object body. */
  body?: EncodableType | ByteString | XmlElement;

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
      const _typeId = (this.body as unknown as {constructor: {[typeId]: NodeIds}}).constructor[typeId];
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

  let name = NodeIds[typeId.value];
  if (!name || !name.endsWith('_Encoding_DefaultBinary')) {
    throw new UaError({code: StatusCode.BadDecodingError});
  }

  name = name.replace(/_Encoding_DefaultBinary$/, '');

  let decodable: DecodableType | undefined;
  switch (name) {
    case 'ServiceFault':
      decodable = ServiceFault;
      break;
    default:
      decodable = GeneratedTypes[name as keyof typeof GeneratedTypes] as DecodableType;
  }

  if (!decodable || !(decode in decodable)) {
    throw new UaError({code: StatusCode.BadDecodingError});
  }

  return BinaryDataDecoder.decodeType(body, decodable);
}