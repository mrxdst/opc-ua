import { Guid } from './Guid';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { Byte, ByteString, UaString, UInt16, UInt32 } from './Primitives';
import { decode, encode, namespaceUriFlag, serverIndexFlag, typeId } from '../symbols';
import { byteStringToUaString, isByte, isByteString, isUaString, isUInt16, isUInt32, uaStringToByteString } from '../util';
import { UaError } from '../UaError';
import { StatusCode } from './StatusCode';
import { NodeIds } from './NodeIds';
import { NodeIdType } from './Generated';

const namespaceUriFlagMask = 0x80;
const serverIndexFlagMask = 0x40;

export type SimpleNodeIdType = NodeIdType.Numeric | NodeIdType.String | NodeIdType.ByteString | NodeIdType.Guid;

export interface NodeIdOptions<T extends SimpleNodeIdType = SimpleNodeIdType> {
  /** The index for a namespace URI. An index of 0 is used for OPC UA defined NodeIds. */
  namespace?: UInt16 | undefined;
  /** The format and data type of the identifier. */
  identifierType: T;
  /** The identifier for a node in the address space of an OPC UA Server. */
  value: NodeIdValueTypeStrict<T>;
  /** Used internally by ExpandedNodeId. */
  [namespaceUriFlag]?: boolean | undefined;
  /** Used internally by ExpandedNodeId. */
  [serverIndexFlag]?: boolean | undefined;
}

export type NumericNodeIdOptions = Omit<NodeIdOptions<NodeIdType.Numeric>, 'identifierType'>;
export type StringNodeIdOptions = Omit<NodeIdOptions<NodeIdType.String>, 'identifierType'>;
export type ByteStringNodeIdOptions = Omit<NodeIdOptions<NodeIdType.ByteString>, 'identifierType'>;
export type GuidNodeIdOptions = Omit<NodeIdOptions<NodeIdType.Guid>, 'identifierType'>;

export type NodeIdValueType<T extends SimpleNodeIdType = SimpleNodeIdType> =
  T extends NodeIdType.Numeric ? UInt32 :
  T extends NodeIdType.String ? UaString :
  T extends NodeIdType.Guid ? Guid :
  T extends NodeIdType.ByteString ? ByteString : never;

export type NodeIdValueTypeStrict<T extends SimpleNodeIdType = SimpleNodeIdType> =
  [T] extends [NodeIdType.Numeric] ? UInt32 :
  [T] extends [NodeIdType.String] ? UaString :
  [T] extends [NodeIdType.Guid] ? Guid :
  [T] extends [NodeIdType.ByteString] ? ByteString : never;

/** An identifier for a node in a UA server address space. */
export class NodeId<T extends SimpleNodeIdType = SimpleNodeIdType> {
  /** The index for a namespace URI. An index of 0 is used for OPC UA defined NodeIds. */
  readonly namespace: UInt16;
  /** The format and data type of the identifier. */
  readonly identifierType: T;
  /** The identifier for a node in the address space of an OPC UA Server. */
  readonly value: NodeIdValueType<T>;
  /** Used internally by ExpandedNodeId. */
  readonly [namespaceUriFlag]: boolean | undefined;
  /** Used internally by ExpandedNodeId. */
  readonly [serverIndexFlag]: boolean | undefined;
  
  constructor(options: NodeIdOptions<T> | NodeId) {
    this.namespace = options.namespace ?? 0;
    this.identifierType = options.identifierType as T;
    this.value = options.value as NodeIdValueType<T>;
    this[namespaceUriFlag] = options[namespaceUriFlag];
    this[serverIndexFlag] = options[serverIndexFlag];

    switch (this.identifierType) {
      case NodeIdType.TwoByte:
      case NodeIdType.FourByte:
      case NodeIdType.Numeric: {
        this.identifierType = NodeIdType.Numeric as T;
        if (!isUInt32(this.value as number) || !isUInt16(this.namespace)) {
          throw new UaError({ code: StatusCode.BadNodeIdInvalid });
        }
        break;
      }
      case NodeIdType.String: {
        if (!isUaString(this.value) || !isUInt16(this.namespace) || (this.value && this.value.length > 4096)) {
          throw new UaError({ code: StatusCode.BadNodeIdInvalid });
        }
        break;
      }
      case NodeIdType.Guid: {
        if (!(this.value instanceof Guid) || !isUInt16(this.namespace)) {
          throw new UaError({ code: StatusCode.BadNodeIdInvalid });
        }
        break;
      }
      case NodeIdType.ByteString: {
        if (!isByteString(this.value) || !isUInt16(this.namespace) || (this.value && this.value.byteLength > 4096)) {
          throw new UaError({ code: StatusCode.BadNodeIdInvalid });
        }
        break;
      }
      default: {
        throw new UaError({ code: StatusCode.BadNodeIdInvalid });
      }
    }
  }

  toString(): string {
    switch (this.identifierType) {
      case NodeIdType.Numeric: {
        if (!this.namespace) {
          return `i=${this.value as number}`;
        }
        return `ns=${this.namespace};i=${this.value as number}`;
      }
      case NodeIdType.String: {
        if (!this.namespace) {
          return `s=${(this.value as UaString) ?? ''}`;
        }
        return `ns=${this.namespace};s=${(this.value as UaString) ?? ''}`;
      }
      case NodeIdType.Guid: {
        if (!this.namespace) {
          return `g={${(this.value as Guid).toString()}}`;
        }
        return `ns=${this.namespace};g={${(this.value as Guid).toString()}}`;
      }
      case NodeIdType.ByteString: {
        if (!this.namespace) {
          return `b=${byteStringToUaString(this.value as ByteString) ?? ''}`;
        }
        return `ns=${this.namespace};b=${byteStringToUaString(this.value as ByteString) ?? ''}`;
      }
      default: {
        return 'Invalid NodeId';
      }
    }
  }
  
  /** Parses the string or number to a NodeId. */
  static parse(str: string | number): NodeId {
    if (typeof str === 'number') {
      if (!isUInt32(str)) {
        throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: 'Numeric identifier out of range'});
      }
      return new NodeId({
        identifierType: NodeIdType.Numeric,
        value: str
      });
    }

    if (!str) {
      throw new UaError({code: StatusCode.BadNodeIdInvalid});
    }

    const _ns = /^ns=(\d+);(.*)/.exec(str);
    const namespace = _ns ? parseInt(_ns[1] as string) : 0;
    const id = _ns ? _ns[2] as string : str;

    if (!isUInt16(namespace)) {
      throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: 'Namespace out of range'});
    }

    const numericMatch = /^i=(\d+)$/.exec(id);
    if (numericMatch) {
      const value = parseInt(numericMatch[1] as string);
      if (!isUInt32(value)) {
        throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: 'Identifier value out of range'});
      }
      return new NodeId({
        identifierType: NodeIdType.Numeric,
        namespace,
        value
      });
    }

    const stringMatch = /^s=(.*)$/.exec(id);
    if (stringMatch) {
      const value = stringMatch[1] as string;
      if (value.length > 4096) {
        throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: 'Identifier value out of range'});
      }
      return new NodeId({
        identifierType: NodeIdType.String,
        namespace,
        value
      });
    }

    const byteStringMatch = /^b=(.*)$/.exec(id);
    if (byteStringMatch) {
      const value = uaStringToByteString(byteStringMatch[1]);
      if (value && value.byteLength > 4096) {
        throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: 'Identifier value out of range'});
      }
      return new NodeId({
        identifierType: NodeIdType.ByteString,
        namespace,
        value
      });
    }

    const guidMatch = /^g=\{([\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12})\}$/.exec(id);
    if (guidMatch) {
      return new NodeId({
        identifierType: NodeIdType.Guid,
        namespace,
        value: Guid.parse(guidMatch[1] as string)
      });
    }

    throw new UaError({code: StatusCode.BadNodeIdInvalid});
  }

  /** Return a new null NodeId */
  static null(): NodeId<NodeIdType.Numeric> {
    return new NodeId({identifierType: NodeIdType.Numeric, value: 0});
  }

  isNull(): boolean {
    if (this.namespace !== 0) {
      return false;
    }
    if (!this.value) {
      return true;
    } else if (this.value instanceof Guid) {
      return this.value.isNull();
    } else if (this.value instanceof Uint8Array) {
      return this.value.byteLength === 0;
    } else {
      return false;
    }
  }

  static readonly Numeric: new (options: NumericNodeIdOptions) => NodeId<NodeIdType.Numeric>;

  static readonly String: new (options: StringNodeIdOptions) => NodeId<NodeIdType.String>;

  static readonly ByteString: new (options: ByteStringNodeIdOptions) => NodeId<NodeIdType.ByteString>;

  static readonly Guid: new (options: GuidNodeIdOptions) => NodeId<NodeIdType.Guid>;

  readonly [typeId] = NodeIds.NodeId as const;
  static readonly [typeId] = NodeIds.NodeId as const;

  [encode](encoder: BinaryDataEncoder): void {
    switch (this.identifierType) {
      case NodeIdType.TwoByte:
      case NodeIdType.FourByte:
      case NodeIdType.Numeric: {
        if (this.namespace === 0 && isByte(this.value as number)) {
          let identifierType: Byte = NodeIdType.TwoByte;
          if (this[namespaceUriFlag]) {
            identifierType |= namespaceUriFlagMask;
          }
          if (this[serverIndexFlag]) {
            identifierType |= serverIndexFlagMask;
          }
          encoder.writeByte(identifierType);
          encoder.writeByte(this.value as number);
        }
        else if (isByte(this.namespace) && isUInt16(this.value as number)) {
          let identifierType: Byte = NodeIdType.FourByte;
          if (this[namespaceUriFlag]) {
            identifierType |= namespaceUriFlagMask;
          }
          if (this[serverIndexFlag]) {
            identifierType |= serverIndexFlagMask;
          }
          encoder.writeByte(identifierType);
          encoder.writeByte(this.namespace);
          encoder.writeUInt16(this.value as number);
        }
        else {
          let identifierType: Byte = this.identifierType;
          if (this[namespaceUriFlag]) {
            identifierType |= namespaceUriFlagMask;
          }
          if (this[serverIndexFlag]) {
            identifierType |= serverIndexFlagMask;
          }
          encoder.writeByte(identifierType);
          encoder.writeUInt16(this.namespace);
          encoder.writeUInt32(this.value as number);
        }
        break;
      }
      case NodeIdType.String: {
        let identifierType: Byte = this.identifierType;
        if (this[namespaceUriFlag]) {
          identifierType |= namespaceUriFlagMask;
        }
        if (this[serverIndexFlag]) {
          identifierType |= serverIndexFlagMask;
        }
        encoder.writeByte(identifierType);
        encoder.writeUInt16(this.namespace);
        encoder.writeString(this.value as UaString);
        break;
      }
      case NodeIdType.Guid: {
        let identifierType: Byte = this.identifierType;
        if (this[namespaceUriFlag]) {
          identifierType |= namespaceUriFlagMask;
        }
        if (this[serverIndexFlag]) {
          identifierType |= serverIndexFlagMask;
        }
        encoder.writeByte(identifierType);
        encoder.writeUInt16(this.namespace);
        encoder.writeType(this.value as Guid);
        break;
      }
      case NodeIdType.ByteString: {
        let identifierType: Byte = this.identifierType;
        if (this[namespaceUriFlag]) {
          identifierType |= namespaceUriFlagMask;
        }
        if (this[serverIndexFlag]) {
          identifierType |= serverIndexFlagMask;
        }
        encoder.writeByte(identifierType);
        encoder.writeUInt16(this.namespace);
        encoder.writeByteString(this.value as ByteString);
        break;
      }
      default: {
        throw new UaError({code: StatusCode.BadNodeIdInvalid});
      }
    }
  }

  static [decode](decoder: BinaryDataDecoder): NodeId {
    let identifierType = decoder.readByte() as NodeIdType;

    let namespaceUriFlagSet: boolean | undefined;
    let serverIndexFlagSet: boolean | undefined;

    if (identifierType & namespaceUriFlagMask) {
      namespaceUriFlagSet = true;
      identifierType &= ~namespaceUriFlagMask;
    }
    if (identifierType & serverIndexFlagMask) {
      serverIndexFlagSet = true;
      identifierType &= ~serverIndexFlagMask;
    }
  
    let namespace: UInt16 = 0;
    let value: NodeIdValueType;

    switch (identifierType) {
      case NodeIdType.TwoByte: {
        identifierType = NodeIdType.Numeric;
        value = decoder.readByte();
        break;
      }
      case NodeIdType.FourByte: {
        identifierType = NodeIdType.Numeric;
        namespace = decoder.readByte();
        value = decoder.readUInt16();
        break;
      }
      case NodeIdType.Numeric: {
        namespace = decoder.readUInt16();
        value = decoder.readUInt32();
        break;
      }
      case NodeIdType.String: {
        namespace = decoder.readUInt16();
        value = decoder.readString();
        break;
      }
      case NodeIdType.Guid: {
        namespace = decoder.readUInt16();
        value = decoder.readType(Guid);
        break;
      }
      case NodeIdType.ByteString: {
        namespace = decoder.readUInt16();
        value = decoder.readByteString();
        break;
      }
      default: {
        throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid IdentifierType'});
      }
    }
    return new NodeId({
      identifierType,
      namespace,
      value: value as NodeIdValueTypeStrict<typeof identifierType>,
      [namespaceUriFlag]: namespaceUriFlagSet,
      [serverIndexFlag]: serverIndexFlagSet
    });
  }
}

class NumericNodeId extends NodeId<NodeIdType.Numeric> {
  constructor(options: NumericNodeIdOptions) {
    super({ identifierType: NodeIdType.Numeric, namespace: options.namespace, value: options.value });
  }
}

class StringNodeId extends NodeId<NodeIdType.String> {
  constructor(options: StringNodeIdOptions) {
    super({ identifierType: NodeIdType.String, namespace: options.namespace, value: options.value });
  }
}

class ByteStringNodeId extends NodeId<NodeIdType.ByteString> {
  constructor(options: ByteStringNodeIdOptions) {
    super({ identifierType: NodeIdType.ByteString, namespace: options.namespace, value: options.value });
  }
}

class GuidNodeId extends NodeId<NodeIdType.Guid> {
  constructor(options: GuidNodeIdOptions) {
    super({ identifierType: NodeIdType.Guid, namespace: options.namespace, value: options.value });
  }
}

(NodeId.Numeric as unknown) = NumericNodeId;
(NodeId.String as unknown) = StringNodeId;
(NodeId.ByteString as unknown) = ByteStringNodeId;
(NodeId.Guid as unknown) = GuidNodeId;
