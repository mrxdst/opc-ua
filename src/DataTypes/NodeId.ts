import { Guid } from './Guid';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { Byte, ByteString, UaString, UInt16, UInt32 } from './Primitives';
import { NodeIdType } from './Generated';
import { decode, encode, namespaceUriFlag, serverIndexFlag } from '../symbols';
import { isByte, isUInt16, isUInt32 } from '../util';
import { UaError } from '../UaError';
import { StatusCode } from './StatusCode';

const namespaceUriFlagMask = 0x80;
const serverIndexFlagMask = 0x40;

export interface NodeIdOptions<
  N extends NodeIdType = NodeIdType,
  V extends NodeIdTypeToValueType<N> = NodeIdTypeToValueType<N>
> {
  /**
   * The index for a namespace URI.  
   * An index of 0 is used for OPC UA defined NodeIds.
   */
  namespace?: UInt16;
  /** The format and data type of the identifier. */
  identifierType: N;
  /** The identifier for a node in the address space of an OPC UA Server. */
  value: V;
  /** Used internaly by ExpandedNodeId. */
  [namespaceUriFlag]?: boolean;
  /** Used internaly by ExpandedNodeId. */
  [serverIndexFlag]?: boolean;
}

export type NodeIdTypeToValueType<T> = 
  T extends NodeIdType.TwoByte ? Byte :
  T extends NodeIdType.FourByte ? UInt16 :
  T extends NodeIdType.Numeric ? UInt32 :
  T extends NodeIdType.String ? UaString :
  T extends NodeIdType.Guid ? Guid :
  T extends NodeIdType.ByteString ? ByteString :
  never;

/** An identifier for a node in a UA server address space. */
export class NodeId<
  N extends NodeIdType = NodeIdType,
  V extends NodeIdTypeToValueType<N> = NodeIdTypeToValueType<N>
> implements NodeIdOptions<N, V> {
  /**
   * The index for a namespace URI.  
   * An index of 0 is used for OPC UA defined NodeIds.
   */
  namespace: UInt16;
  /** The format and data type of the identifier. */
  identifierType: N;
  /** The identifier for a node in the address space of an OPC UA Server. */
  value: V;
  /** Used internaly by ExpandedNodeId. */
  [namespaceUriFlag]?: boolean;
  /** Used internaly by ExpandedNodeId. */
  [serverIndexFlag]?: boolean;
  
  constructor(options: NodeIdOptions<N, V>) {
    this.namespace = options.namespace ?? 0;
    this.identifierType = options.identifierType;
    this.value = options.value;
    this[namespaceUriFlag] = options[namespaceUriFlag];
    this[serverIndexFlag] = options[serverIndexFlag];
  }
  
  /** Parses the string or number to a NodeId. */
  static parse(str: string | number): NodeId {
    if (typeof str === 'number') {
      if (!isUInt32(str)) {
        throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: 'Numeric identifier out of range'});
      }
      let identifierType = NodeIdType.Numeric;
      if (isByte(str)) {
        identifierType = NodeIdType.TwoByte;
      } else if (isUInt16(str)) {
        identifierType = NodeIdType.FourByte;
      }
      return new NodeId({
        identifierType,
        namespace: 0,
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
      let identifierType = NodeIdType.Numeric;
      if (isByte(value) && namespace === 0) {
        identifierType = NodeIdType.TwoByte;
      } else if (isUInt16(value) && isByte(namespace)) {
        identifierType = NodeIdType.FourByte;
      }
      return new NodeId({
        identifierType,
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
      const value = new TextEncoder().encode(byteStringMatch[1]);
      if (value.byteLength > 4096) {
        throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: 'Identifier value out of range'});
      }
      return new NodeId({
        identifierType: NodeIdType.ByteString,
        namespace,
        value: new TextEncoder().encode(byteStringMatch[1])
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
  static null(): NodeId {
    return new NodeId({identifierType: NodeIdType.TwoByte, value: 0});
  }

  toString(): string {
    switch (this.identifierType) {
      case NodeIdType.TwoByte: {
        if (typeof this.value !== 'number' || !isByte(this.value)) {
          return 'Invalid NodeId';
        }
        return `i=${this.value}`;
      }
      case NodeIdType.FourByte: {
        if (typeof this.value !== 'number' || !isUInt16(this.value) || !isByte(this.namespace)) {
          return 'Invalid NodeId';
        }
        if (!this.namespace) {
          return `i=${this.value}`;
        }
        return `ns=${this.namespace};i=${this.value}`;
      }
      case NodeIdType.Numeric: {
        if (typeof this.value !== 'number' || !isUInt32(this.value) || !isUInt16(this.namespace)) {
          return 'Invalid NodeId';
        }
        if (!this.namespace) {
          return `i=${this.value}`;
        }
        return `ns=${this.namespace};i=${this.value}`;
      }
      case NodeIdType.String: {
        if ((typeof this.value !== 'string' && this.value !== undefined) || !isUInt16(this.namespace)) {
          return 'Invalid NodeId';
        }
        const text = (this.value ?? '') as string;
        if (text.length > 4096) {
          return 'Invalid NodeId';
        }
        if (!this.namespace) {
          return `s=${text}`;
        }
        return `ns=${this.namespace};s=${text}`;
      }
      case NodeIdType.Guid: {
        if (!(this.value instanceof Guid) || !isUInt16(this.namespace)) {
          return 'Invalid NodeId';
        }
        if (!this.namespace) {
          return `g={${this.value.toString()}}`;
        }
        return `ns=${this.namespace};g={${this.value.toString()}}`;
      }
      case NodeIdType.ByteString: {
        if ((!(this.value instanceof Uint8Array) && this.value !== undefined) || !isUInt16(this.namespace)) {
          return 'Invalid NodeId';
        }
        const value = (this.value as Uint8Array) ?? new Uint8Array();
        if (value.byteLength > 4096) {
          return 'Invalid NodeId';
        }
        const text = new TextDecoder().decode(value);
        if (!this.namespace) {
          return `b=${text}`;
        }
        return `ns=${this.namespace};b=${text}`;
      }
      default: {
        return 'Invalid NodeId';
      }
    }
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

  [encode](encoder: BinaryDataEncoder): void {
    let identifierType: Byte = this.identifierType;
    if (this[namespaceUriFlag]) {
      identifierType |= namespaceUriFlagMask;
    }
    if (this[serverIndexFlag]) {
      identifierType |= serverIndexFlagMask;
    }
    encoder.writeByte(identifierType);

    switch (this.identifierType) {
      case NodeIdType.TwoByte: {
        if (typeof this.value !== 'number') {
          throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: `Value doesn't match IdentifierType`});
        }
        encoder.writeByte(this.value);
        break;
      }
      case NodeIdType.FourByte: {
        if (typeof this.value !== 'number') {
          throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: `Value doesn't match IdentifierType`});
        }
        encoder.writeByte(this.namespace);
        encoder.writeUInt16(this.value);
        break;
      }
      case NodeIdType.Numeric: {
        if (typeof this.value !== 'number') {
          throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: `Value doesn't match IdentifierType`});
        }
        encoder.writeUInt16(this.namespace);
        encoder.writeUInt32(this.value as number);
        break;
      }
      case NodeIdType.String: {
        if (typeof this.value !== 'string' && this.value !== undefined) {
          throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: `Value doesn't match IdentifierType`});
        }
        const value = this.value as UaString;
        if ((value?.length ?? 0) > 4096) {
          throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: 'String identifier too long'});
        }
        encoder.writeUInt16(this.namespace);
        encoder.writeString(value);
        break;
      }
      case NodeIdType.Guid: {
        if (!(this.value instanceof Guid)) {
          throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: `Value doesn't match IdentifierType`});
        }
        encoder.writeUInt16(this.namespace);
        encoder.writeType(this.value as Guid);
        break;
      }
      case NodeIdType.ByteString: {
        if (!(this.value instanceof Uint8Array) && this.value !== undefined) {
          throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: `Value doesn't match IdentifierType`});
        }
        const value = this.value as ByteString;
        if ((value?.byteLength ?? 0) > 4096) {
          throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: 'ByteString identifier too long'});
        }
        encoder.writeUInt16(this.namespace);
        encoder.writeByteString(value);
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
    let value: NodeIdTypeToValueType<NodeIdType>;

    switch (identifierType) {
      case NodeIdType.TwoByte: {
        value = decoder.readByte();
        break;
      }
      case NodeIdType.FourByte: {
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
      value,
      [namespaceUriFlag]: namespaceUriFlagSet,
      [serverIndexFlag]: serverIndexFlagSet
    });
  }
}

export interface TwoByteNodeIdOptions {
  /** The identifier for a node in the address space of an OPC UA Server. */
  value?: NodeIdTypeToValueType<NodeIdType.TwoByte>;
}

/** An identifier for a node in a UA server address space. */
export class TwoByteNodeId extends NodeId<NodeIdType.TwoByte> {
  constructor(options?: TwoByteNodeIdOptions) {
    super({
      value: options?.value ?? 0,
      namespace: 0,
      identifierType: NodeIdType.TwoByte
    });
  }
}

export interface FourByteNodeIdOptions {
  /**
   * The index for a namespace URI.  
   * An index of 0 is used for OPC UA defined NodeIds.
   */
  namespace?: Byte;
  /** The identifier for a node in the address space of an OPC UA Server. */
  value?: NodeIdTypeToValueType<NodeIdType.FourByte>;
}

/** An identifier for a node in a UA server address space. */
export class FourByteNodeId extends NodeId<NodeIdType.FourByte> {
  constructor(options?: FourByteNodeIdOptions) {
    super({
      value: options?.value ?? 0,
      namespace: options?.namespace ?? 0,
      identifierType: NodeIdType.FourByte
    });
  }
}

export interface NumericNodeIdOptions {
  /**
   * The index for a namespace URI.  
   * An index of 0 is used for OPC UA defined NodeIds.
   */
  namespace?: UInt16;
  /** The identifier for a node in the address space of an OPC UA Server. */
  value?: NodeIdTypeToValueType<NodeIdType.Numeric>;
}

/** An identifier for a node in a UA server address space. */
export class NumericNodeId extends NodeId<NodeIdType.Numeric> {
  constructor(options?: NumericNodeIdOptions) {
    super({
      value: options?.value ?? 0,
      namespace: options?.namespace ?? 0,
      identifierType: NodeIdType.Numeric
    });
  }
}

export interface StringNodeIdOptions {
  /**
   * The index for a namespace URI.  
   * An index of 0 is used for OPC UA defined NodeIds.
   */
  namespace?: UInt16;
  /** The identifier for a node in the address space of an OPC UA Server. */
  value?: NodeIdTypeToValueType<NodeIdType.String>;
}

/** An identifier for a node in a UA server address space. */
export class StringNodeId extends NodeId<NodeIdType.String> {
  constructor(options?: StringNodeIdOptions) {
    super({
      value: options?.value,
      namespace: options?.namespace ?? 0,
      identifierType: NodeIdType.String
    });
  }
}

export interface GuidNodeIdOptions {
  /**
   * The index for a namespace URI.  
   * An index of 0 is used for OPC UA defined NodeIds.
   */
  namespace?: UInt16;
  /** The identifier for a node in the address space of an OPC UA Server. */
  value?: NodeIdTypeToValueType<NodeIdType.Guid>;
}

/** An identifier for a node in a UA server address space. */
export class GuidNodeId extends NodeId<NodeIdType.Guid> {
  constructor(options?: GuidNodeIdOptions) {
    super({
      value: options?.value ?? new Guid(),
      namespace: options?.namespace ?? 0,
      identifierType: NodeIdType.Guid
    });
  }
}

export interface ByteStringNodeIdOptions {
  /**
   * The index for a namespace URI.  
   * An index of 0 is used for OPC UA defined NodeIds.
   */
  namespace?: UInt16;
  /** The identifier for a node in the address space of an OPC UA Server. */
  value?: NodeIdTypeToValueType<NodeIdType.ByteString>;
}

/** An identifier for a node in a UA server address space. */
export class ByteStringNodeId extends NodeId<NodeIdType.ByteString> {
  constructor(options?: ByteStringNodeIdOptions) {
    super({
      value: options?.value,
      namespace: options?.namespace ?? 0,
      identifierType: NodeIdType.ByteString
    });
  }
}
