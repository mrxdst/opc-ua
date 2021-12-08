import ndarray, { NdArray } from 'ndarray';
import { BinaryDataEncoder, BinaryDataDecoder } from '../BinaryDataEncoding';
import { isByteString, isUaString } from '../util';
import { DataValue } from './DataValue';
import { DiagnosticInfo } from './DiagnosticInfo';
import { ExpandedNodeId } from './ExpandedNodeId';
import { ExtensionObject } from './ExtensionObject';
import { LocalizedText } from './LocalizedText';
import { ByteString, Double, Float, Int16, Int64, Byte, Int32, SByte, UaString, UInt16, UInt32, UInt64, XmlElement } from './Primitives';
import { Guid } from './Guid';
import { StatusCode } from './StatusCode';
import { NodeId } from './NodeId';
import { QualifiedName } from './QualifiedName';
import { decode, encode, typeId } from '../symbols';
import { UaError } from '../UaError';
import { NodeIds } from './NodeIds';

const arrayDimensionsMask = 0x40;
const arrayValuesMask = 0x80;

export enum VariantTypeId {
  Null = 0,
  Boolean = 1,
  SByte = 2,
  Byte = 3,
  Int16 = 4,
  UInt16 = 5,
  Int32 = 6,
  UInt32 = 7,
  Int64 = 8,
  UInt64 = 9,
  Float = 10,
  Double = 11,
  String = 12,
  DateTime = 13,
  Guid = 14,
  ByteString = 15,
  XmlElement = 16,
  NodeId = 17,
  ExpandedNodeId = 18,
  StatusCode = 19,
  QualifiedName = 20,
  LocalizedText = 21,
  ExtensionObject = 22,
  DataValue = 23,
  Variant = 24,
  DiagnosticInfo = 25
}

export enum VariantType {
  Scalar = -1,
  Array = 1,
  NdArray = 0
}

export type VariantValueType<T extends VariantTypeId = VariantTypeId> =
  T extends VariantTypeId.Null            ? undefined :
  T extends VariantTypeId.Boolean         ? boolean :
  T extends VariantTypeId.SByte           ? SByte :
  T extends VariantTypeId.Byte            ? Byte :
  T extends VariantTypeId.Int16           ? Int16 :
  T extends VariantTypeId.UInt16          ? UInt16 :
  T extends VariantTypeId.Int32           ? Int32 :
  T extends VariantTypeId.UInt32          ? UInt32 :
  T extends VariantTypeId.Int64           ? Int64 :
  T extends VariantTypeId.UInt64          ? UInt64 :
  T extends VariantTypeId.Float           ? Float :
  T extends VariantTypeId.Double          ? Double :
  T extends VariantTypeId.String          ? UaString :
  T extends VariantTypeId.DateTime        ? Date :
  T extends VariantTypeId.Guid            ? Guid :
  T extends VariantTypeId.ByteString      ? ByteString :
  T extends VariantTypeId.XmlElement      ? XmlElement :
  T extends VariantTypeId.NodeId          ? NodeId :
  T extends VariantTypeId.ExpandedNodeId  ? ExpandedNodeId :
  T extends VariantTypeId.StatusCode      ? StatusCode :
  T extends VariantTypeId.QualifiedName   ? QualifiedName :
  T extends VariantTypeId.LocalizedText   ? LocalizedText :
  T extends VariantTypeId.ExtensionObject ? ExtensionObject :
  T extends VariantTypeId.DataValue       ? DataValue :
  T extends VariantTypeId.Variant         ? Variant :
  T extends VariantTypeId.DiagnosticInfo  ? DiagnosticInfo : never;

export type VariantScalarType<T extends VariantTypeId = VariantTypeId> = VariantValueType<T>;

export type VariantArrayType<T extends VariantTypeId = VariantTypeId> =
  T extends VariantTypeId.SByte           ? ReadonlyArray<VariantValueType<T>> | undefined | Int8Array :
  T extends VariantTypeId.Byte            ? ReadonlyArray<VariantValueType<T>> | undefined | Uint8Array :
  T extends VariantTypeId.Int16           ? ReadonlyArray<VariantValueType<T>> | undefined | Int16Array :
  T extends VariantTypeId.UInt16          ? ReadonlyArray<VariantValueType<T>> | undefined | Uint16Array :
  T extends VariantTypeId.Int32           ? ReadonlyArray<VariantValueType<T>> | undefined | Int32Array :
  T extends VariantTypeId.UInt32          ? ReadonlyArray<VariantValueType<T>> | undefined | Uint32Array :
  T extends VariantTypeId.Int64           ? ReadonlyArray<VariantValueType<T>> | undefined | BigInt64Array :
  T extends VariantTypeId.UInt64          ? ReadonlyArray<VariantValueType<T>> | undefined | BigInt64Array :
  T extends VariantTypeId.Float           ? ReadonlyArray<VariantValueType<T>> | undefined | Float32Array :
  T extends VariantTypeId.Double          ? ReadonlyArray<VariantValueType<T>> | undefined | Float64Array : 
  ReadonlyArray<VariantValueType<T>> | undefined;

export type VariantNdArrayType<T extends VariantTypeId = VariantTypeId> = NdArray<VariantValueType<T>[]> | undefined;

export type VariantValue<T extends VariantType = VariantType, V extends VariantTypeId = VariantTypeId> = 
  T extends VariantType.Scalar  ? VariantScalarType<V>  :
  T extends VariantType.Array   ? VariantArrayType<V>   :
  T extends VariantType.NdArray ? VariantNdArrayType<V> : never;

export interface VariantOptions<T extends VariantType = VariantType, V extends VariantTypeId = VariantTypeId> {
  /** The variant type. */
  type: T;
  /** The type of the value. */
  typeId: V;
  /** The value. */
  value: VariantValue<T, V>;
}

export type ScalarVariantOptions<T extends VariantTypeId = VariantTypeId> = Omit<VariantOptions<VariantType.Scalar, T>, 'type'>;

export type ArrayVariantOptions<T extends VariantTypeId = VariantTypeId> = Omit<VariantOptions<VariantType.Array, T>, 'type'>;

export type NdArrayVariantOptions<T extends VariantTypeId = VariantTypeId> = Omit<VariantOptions<VariantType.NdArray, T>, 'type'>;

/** A union of several types. */
export class Variant<T extends VariantType = VariantType, V extends VariantTypeId = VariantTypeId> implements VariantOptions<T, V> {
  /** The variant type. */
  readonly type: T;
  /** The type of the value. */
  readonly typeId: V;
  /** The value. */
  readonly value: VariantValue<T, V>;

  constructor(options: VariantOptions<T, V>) {
    this.type = options.type;
    this.typeId = options.typeId;
    this.value = options.value;

    // Types are verified during encoding
  }

  toString(): string {
    return this.value?.toString() ?? 'undefined';
  }

  /** Return a new null Variant */
  static null(): Variant<VariantType.Scalar, VariantTypeId.Null> {
    return new Variant({
      type: VariantType.Scalar,
      typeId: VariantTypeId.Null,
      value: undefined
    });
  }

  isNull(): this is Variant<VariantType, VariantTypeId.Null> {
    return this.typeId === VariantTypeId.Null;
  }

  static readonly Scalar = class ScalarVariant<T extends VariantTypeId = VariantTypeId> extends Variant<VariantType.Scalar, T> {
    constructor(options: ScalarVariantOptions<T>) {
      super({ type: VariantType.Scalar, typeId: options.typeId, value: options.value });
    }
  };

  static readonly Array = class ArrayVariant<T extends VariantTypeId = VariantTypeId> extends Variant<VariantType.Array, T> {
    constructor(options: ArrayVariantOptions<T>) {
      super({ type: VariantType.Array, typeId: options.typeId, value: options.value });
    }
  };

  static readonly NdArray = class NdArrayVariant<T extends VariantTypeId = VariantTypeId> extends Variant<VariantType.NdArray, T> {
    constructor(options: NdArrayVariantOptions<T>) {
      super({ type: VariantType.NdArray, typeId: options.typeId, value: options.value });
    }
  };

  static [typeId] = NodeIds.BaseDataType as const;

  [encode](encoder: BinaryDataEncoder): void {
    if (this.typeId === VariantTypeId.Null) {
      encoder.writeByte(0);
      return;
    }

    let encodingMask = this.typeId as Byte;

    switch (this.type) {
      case VariantType.Scalar: {
        encoder.writeByte(encodingMask);
        writeVariantValue(encoder, this.typeId, this.value as VariantValueType<V>);
        break;
      }
      case VariantType.Array: {
        const value = this.value as VariantArrayType<V>;
        if (!value) {
          encodingMask |= arrayValuesMask;
          encoder.writeByte(encodingMask);
          encoder.writeInt32(-1);
        } else {
          encodingMask |= arrayValuesMask;
          encoder.writeByte(encodingMask);
          encoder.writeInt32(value.length);
          for (let i = 0; i < value.length; i++) {
            writeVariantValue(encoder, this.typeId, value[i] as VariantValueType<V>);
          }
        }
        break;
      }
      case VariantType.NdArray: {
        const value = this.value as VariantNdArrayType<V>;
        if (!value) {
          encodingMask |= arrayValuesMask;
          encoder.writeByte(encodingMask);
          encoder.writeInt32(-1);
        } else {
          encodingMask |= arrayValuesMask;
          encodingMask |= arrayDimensionsMask;
          encoder.writeByte(encodingMask);
          encoder.writeInt32(value.data.length);
          for (let i = 0; i < value.data.length; i++) {
            writeVariantValue(encoder, this.typeId, value.data[i] as VariantValueType<V>);
          }
          encoder.writeInt32(value.shape.length);
          for (let i = 0; i < value.shape.length; i++) {
            encoder.writeInt32(value.shape[i] as number);
          }
        }
        break;
      }
    }
  }

  static [decode](decoder: BinaryDataDecoder): Variant {
    let typeId = decoder.readByte() as VariantTypeId;

    const arrayValuesFlag = !!(typeId & arrayValuesMask);
    const arrayDimensionsFlag = !!(typeId & arrayDimensionsMask);
    typeId &= ~arrayValuesMask;
    typeId &= ~arrayDimensionsMask;

    if (typeId === VariantTypeId.Null) {
      return Variant.null();
    }

    if (typeId >= 26 && typeId <= 31) {
      typeId = VariantTypeId.ByteString;
    }

    let type: VariantType;
    let value: VariantValue;

    if (arrayValuesFlag) {
      type = VariantType.Array;
      const arrayLength = decoder.readInt32();
      if (arrayLength < 0) {
        value = undefined;
      } else {
        value = [];
        for (let i = 0; i < arrayLength; i++) {
          (value as VariantValueType[]).push(readVariantValue(decoder, typeId));
        }
      }

      if (arrayDimensionsFlag) {
        type = VariantType.NdArray;
        const arrayDimensions = decoder.readInt32Array() ?? [0];

        if (value) {
          value = ndarray(value as number[], arrayDimensions);
        }
      }
    } else {
      type = VariantType.Scalar;
      value = readVariantValue(decoder, typeId);
    }

    return new Variant({
      type,
      typeId,
      value
    });
  }
}

export function writeVariantValue<T extends VariantTypeId = VariantTypeId>(encoder: BinaryDataEncoder, typeId: T, value: VariantValueType<T>): void {
  if (!isVariantValue(typeId, value)) {
    throw new UaError({code: StatusCode.BadInvalidArgument, reason: `Invalid Value for TypeId=${VariantTypeId[typeId] ?? typeId}`});
  }

  switch (typeId) {
    case VariantTypeId.Boolean: {
      encoder.writeBoolean(value as boolean);
      break;
    }
    case VariantTypeId.SByte: {
      encoder.writeSByte(value as SByte);
      break;
    }
    case VariantTypeId.Byte: {
      encoder.writeByte(value as Byte);
      break;
    }
    case VariantTypeId.Int16: {
      encoder.writeInt16(value as Int16);
      break;
    }
    case VariantTypeId.UInt16: {
      encoder.writeUInt16(value as UInt16);
      break;
    }
    case VariantTypeId.Int32: {
      encoder.writeInt32(value as Int32);
      break;
    }
    case VariantTypeId.UInt32: {
      encoder.writeUInt32(value as UInt32);
      break;
    }
    case VariantTypeId.Int64: {
      encoder.writeInt64(value as Int64);
      break;
    }
    case VariantTypeId.UInt64: {
      encoder.writeUInt64(value as UInt64);
      break;
    }
    case VariantTypeId.Float: {
      encoder.writeFloat(value as Float);
      break;
    }
    case VariantTypeId.Double: {
      encoder.writeDouble(value as Double);
      break;
    }
    case VariantTypeId.String: {
      encoder.writeString(value as UaString);
      break;
    }
    case VariantTypeId.DateTime: {
      encoder.writeDateTime(value as Date);
      break;
    }
    case VariantTypeId.Guid: {
      encoder.writeType(value as Guid);
      break;
    }
    case VariantTypeId.ByteString: {
      encoder.writeByteString(value as ByteString);
      break;
    }
    case VariantTypeId.XmlElement: {
      encoder.writeXmlElement(value as XmlElement);
      break;
    }
    case VariantTypeId.NodeId: {
      encoder.writeType(value as NodeId);
      break;
    }
    case VariantTypeId.ExpandedNodeId: {
      encoder.writeType(value as ExpandedNodeId);
      break;
    }
    case VariantTypeId.StatusCode: {
      encoder.writeType(value as StatusCode);
      break;
    }
    case VariantTypeId.QualifiedName: {
      encoder.writeType(value as QualifiedName);
      break;
    }
    case VariantTypeId.LocalizedText: {
      encoder.writeType(value as LocalizedText);
      break;
    }
    case VariantTypeId.ExtensionObject: {
      encoder.writeType(value as ExtensionObject);
      break;
    }
    case VariantTypeId.DataValue: {
      encoder.writeType(value as DataValue);
      break;
    }
    case VariantTypeId.Variant: {
      encoder.writeType(value as Variant);
      break;
    }
    case VariantTypeId.DiagnosticInfo: {
      encoder.writeType(value as DiagnosticInfo);
      break;
    }
    default: {
      // Should never happen as isVariantValue throws on invalid TypeId
      throw new UaError({code: StatusCode.BadUnexpectedError});
    }
  }
}

export function readVariantValue<T extends VariantTypeId = VariantTypeId>(decoder: BinaryDataDecoder, typeId: T): VariantValueType<T> {
  switch (typeId) {
    case VariantTypeId.Boolean: {
      return decoder.readBoolean() as VariantValueType<T>;
    }
    case VariantTypeId.SByte: {
      return decoder.readSByte() as VariantValueType<T>;
    }
    case VariantTypeId.Byte: {
      return decoder.readByte() as VariantValueType<T>;
    }
    case VariantTypeId.Int16: {
      return decoder.readInt16() as VariantValueType<T>;
    }
    case VariantTypeId.UInt16: {
      return decoder.readUInt16() as VariantValueType<T>;
    }
    case VariantTypeId.Int32: {
      return decoder.readInt32() as VariantValueType<T>;
    }
    case VariantTypeId.UInt32: {
      return decoder.readUInt32() as VariantValueType<T>;
    }
    case VariantTypeId.Int64: {
      return decoder.readInt64() as VariantValueType<T>;
    }
    case VariantTypeId.UInt64: {
      return decoder.readUInt64() as VariantValueType<T>;
    }
    case VariantTypeId.Float: {
      return decoder.readFloat() as VariantValueType<T>;
    }
    case VariantTypeId.Double: {
      return decoder.readDouble() as VariantValueType<T>;
    }
    case VariantTypeId.String: {
      return decoder.readString() as VariantValueType<T>;
    }
    case VariantTypeId.DateTime: {
      return decoder.readDateTime() as VariantValueType<T>;
    }
    case VariantTypeId.Guid: {
      return decoder.readType(Guid) as VariantValueType<T>;
    }
    case VariantTypeId.ByteString: {
      return decoder.readByteString() as VariantValueType<T>;
    }
    case VariantTypeId.XmlElement: {
      return decoder.readXmlElement() as VariantValueType<T>;
    }
    case VariantTypeId.NodeId: {
      return decoder.readType(NodeId) as VariantValueType<T>;
    }
    case VariantTypeId.ExpandedNodeId: {
      return decoder.readType(ExpandedNodeId) as VariantValueType<T>;
    }
    case VariantTypeId.StatusCode: {
      return decoder.readType(StatusCode) as VariantValueType<T>;
    }
    case VariantTypeId.QualifiedName: {
      return decoder.readType(QualifiedName) as VariantValueType<T>;
    }
    case VariantTypeId.LocalizedText: {
      return decoder.readType(LocalizedText) as VariantValueType<T>;
    }
    case VariantTypeId.ExtensionObject: {
      return decoder.readType(ExtensionObject) as VariantValueType<T>;
    }
    case VariantTypeId.DataValue: {
      return decoder.readType(DataValue) as VariantValueType<T>;
    }
    case VariantTypeId.Variant: {
      return decoder.readType(Variant) as VariantValueType<T>;
    }
    case VariantTypeId.DiagnosticInfo: {
      return decoder.readType(DiagnosticInfo) as VariantValueType<T>;
    }
    default: {
      throw new UaError({code: StatusCode.BadInvalidArgument, reason: 'Invalid TypeId'});
    }
  }
}

export function isVariantValue<T extends VariantTypeId = VariantTypeId>(typeId: T, value: VariantValueType<VariantTypeId>): value is VariantValueType<T> {
  switch (typeId) {
    case VariantTypeId.Null: {
      return typeof value === 'undefined';
    }
    case VariantTypeId.Boolean: {
      return typeof value === 'boolean';
    }
    case VariantTypeId.SByte:
    case VariantTypeId.Byte:
    case VariantTypeId.Int16:
    case VariantTypeId.UInt16:
    case VariantTypeId.Int32:
    case VariantTypeId.UInt32:
    case VariantTypeId.Float:
    case VariantTypeId.Double: {
      return typeof value === 'number';
    }
    case VariantTypeId.StatusCode: {
      return value instanceof StatusCode;
    }
    case VariantTypeId.Int64:
    case VariantTypeId.UInt64: {
      return typeof value === 'bigint';
    }
    case VariantTypeId.String:
    case VariantTypeId.XmlElement: {
      return isUaString(value);
    }
    case VariantTypeId.DateTime: {
      return value instanceof Date;
    }
    case VariantTypeId.Guid: {
      return value instanceof Guid;
    }
    case VariantTypeId.ByteString: {
      return isByteString(value);
    }
    case VariantTypeId.NodeId: {
      return value instanceof NodeId;
    }
    case VariantTypeId.ExpandedNodeId: {
      return value instanceof ExpandedNodeId;
    }
    case VariantTypeId.QualifiedName: {
      return value instanceof QualifiedName;
    }
    case VariantTypeId.LocalizedText: {
      return value instanceof LocalizedText;
    }
    case VariantTypeId.ExtensionObject: {
      return value instanceof ExtensionObject;
    }
    case VariantTypeId.DataValue: {
      return value instanceof DataValue;
    }
    case VariantTypeId.Variant: {
      return value instanceof Variant;
    }
    case VariantTypeId.DiagnosticInfo: {
      return value instanceof DiagnosticInfo;
    }
    default: {
      throw new UaError({code: StatusCode.BadInvalidArgument, reason: 'Invalid TypeId'});
    }
  }
}