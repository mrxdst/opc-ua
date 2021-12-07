import { Variant, isVariantValue, VariantTypeId, readVariantValue, writeVariantValue, VariantType } from './Variant';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { Guid } from './Guid';
import { NodeId } from './NodeId';
import { StatusCode } from './StatusCode';
import { ExtensionObject } from './ExtensionObject';
import { ExpandedNodeId } from './ExpandedNodeId';
import { QualifiedName } from './QualifiedName';
import { LocalizedText } from './LocalizedText';
import { DataValue } from './DataValue';
import { DiagnosticInfo } from './DiagnosticInfo';
import ndarray from 'ndarray';
import { UaError } from '../UaError';

test('Encode/Decode', () => {
  const encoder = new BinaryDataEncoder();

  encoder.writeType(new Variant({type: VariantType.Scalar, typeId: VariantTypeId.Null, value: undefined}));
  encoder.writeType(new Variant({type: VariantType.Scalar, typeId: VariantTypeId.Boolean, value: true}));
  encoder.writeType(new Variant({type: VariantType.Array, typeId: VariantTypeId.Boolean, value: [true, false]}));
  encoder.writeType(new Variant({type: VariantType.NdArray, typeId: VariantTypeId.Int32, value: ndarray([1,2,3,4,5,6,7,8], [2,2,2])}));

  const decoder = new BinaryDataDecoder(encoder.finish());

  expect(decoder.readType(Variant).value).toBe(undefined);
  expect(decoder.readType(Variant).value).toBe(true);
  expect(decoder.readType(Variant).value).toStrictEqual([true, false]);
  expect(decoder.readType(Variant).value).toStrictEqual(ndarray([1,2,3,4,5,6,7,8], [2,2,2]));
});

test('isVariantValue', () => {
  expect(isVariantValue(VariantTypeId.Null, undefined)).toBe(true);
  expect(isVariantValue(VariantTypeId.Boolean, true)).toBe(true);
  expect(isVariantValue(VariantTypeId.SByte, 1)).toBe(true);
  expect(isVariantValue(VariantTypeId.Byte, 1)).toBe(true);
  expect(isVariantValue(VariantTypeId.Int16, 1)).toBe(true);
  expect(isVariantValue(VariantTypeId.UInt16, 1)).toBe(true);
  expect(isVariantValue(VariantTypeId.Int32, 1)).toBe(true);
  expect(isVariantValue(VariantTypeId.UInt32, 1)).toBe(true);
  expect(isVariantValue(VariantTypeId.Int64, BigInt(1))).toBe(true);
  expect(isVariantValue(VariantTypeId.UInt64, BigInt(1))).toBe(true);
  expect(isVariantValue(VariantTypeId.Float, 1)).toBe(true);
  expect(isVariantValue(VariantTypeId.Double, 1)).toBe(true);
  expect(isVariantValue(VariantTypeId.String, '')).toBe(true);
  expect(isVariantValue(VariantTypeId.DateTime, new Date())).toBe(true);
  expect(isVariantValue(VariantTypeId.Guid, Guid.new())).toBe(true);
  expect(isVariantValue(VariantTypeId.ByteString, new Uint8Array())).toBe(true);
  expect(isVariantValue(VariantTypeId.XmlElement, '')).toBe(true);
  expect(isVariantValue(VariantTypeId.NodeId, NodeId.parse('i=1'))).toBe(true);
  expect(isVariantValue(VariantTypeId.ExpandedNodeId, new ExpandedNodeId({nodeId: NodeId.parse('i=1')}))).toBe(true);
  expect(isVariantValue(VariantTypeId.StatusCode, StatusCode.BadInternalError)).toBe(true);
  expect(isVariantValue(VariantTypeId.QualifiedName, new QualifiedName({namespaceIndex: 0}))).toBe(true);
  expect(isVariantValue(VariantTypeId.LocalizedText, new LocalizedText())).toBe(true);
  expect(isVariantValue(VariantTypeId.ExtensionObject, new ExtensionObject({typeId: NodeId.parse('i=1')}))).toBe(true);
  expect(isVariantValue(VariantTypeId.DataValue, new DataValue())).toBe(true);
  expect(isVariantValue(VariantTypeId.Variant, new Variant({type: VariantType.Scalar, typeId: VariantTypeId.Boolean, value: true}))).toBe(true);
  expect(isVariantValue(VariantTypeId.DiagnosticInfo, new DiagnosticInfo())).toBe(true);

  expect(() => isVariantValue(255 as VariantTypeId, 1)).toThrowError(UaError);
});

test('Read/Write VariantValue', () => {
  const encoder = new BinaryDataEncoder();

  writeVariantValue(encoder, VariantTypeId.Boolean, true);
  writeVariantValue(encoder, VariantTypeId.SByte, 1);
  writeVariantValue(encoder, VariantTypeId.Byte, 1);
  writeVariantValue(encoder, VariantTypeId.Int16, 1);
  writeVariantValue(encoder, VariantTypeId.UInt16, 1);
  writeVariantValue(encoder, VariantTypeId.Int32, 1);
  writeVariantValue(encoder, VariantTypeId.UInt32, 1);
  writeVariantValue(encoder, VariantTypeId.Int64, BigInt(1));
  writeVariantValue(encoder, VariantTypeId.UInt64, BigInt(1));
  writeVariantValue(encoder, VariantTypeId.Float, 1);
  writeVariantValue(encoder, VariantTypeId.Double, 1);
  writeVariantValue(encoder, VariantTypeId.String, '');
  writeVariantValue(encoder, VariantTypeId.DateTime, new Date());
  writeVariantValue(encoder, VariantTypeId.Guid, Guid.new());
  writeVariantValue(encoder, VariantTypeId.ByteString, new Uint8Array());
  writeVariantValue(encoder, VariantTypeId.XmlElement, '');
  writeVariantValue(encoder, VariantTypeId.NodeId, NodeId.parse('i=1'));
  writeVariantValue(encoder, VariantTypeId.ExpandedNodeId, new ExpandedNodeId({nodeId: NodeId.parse('i=1')}));
  writeVariantValue(encoder, VariantTypeId.StatusCode, StatusCode.BadInternalError);
  writeVariantValue(encoder, VariantTypeId.QualifiedName, new QualifiedName({namespaceIndex: 1}));
  writeVariantValue(encoder, VariantTypeId.LocalizedText, new LocalizedText());
  writeVariantValue(encoder, VariantTypeId.ExtensionObject, new ExtensionObject({typeId: NodeId.parse('i=1')}));
  writeVariantValue(encoder, VariantTypeId.DataValue, new DataValue());
  writeVariantValue(encoder, VariantTypeId.Variant, new Variant({type: VariantType.Scalar, typeId: VariantTypeId.Boolean, value: true}));
  writeVariantValue(encoder, VariantTypeId.DiagnosticInfo, new DiagnosticInfo());

  expect(() => writeVariantValue(encoder, VariantTypeId.Boolean as VariantTypeId.Byte, 1)).toThrowError(UaError);

  const decoder = new BinaryDataDecoder(encoder.finish());

  expect(readVariantValue(decoder, VariantTypeId.Boolean)).toBe(true);
  expect(readVariantValue(decoder, VariantTypeId.SByte)).toBe(1);
  expect(readVariantValue(decoder, VariantTypeId.Byte)).toBe(1);
  expect(readVariantValue(decoder, VariantTypeId.Int16)).toBe(1);
  expect(readVariantValue(decoder, VariantTypeId.UInt16)).toBe(1);
  expect(readVariantValue(decoder, VariantTypeId.Int32)).toBe(1);
  expect(readVariantValue(decoder, VariantTypeId.UInt32)).toBe(1);
  expect(readVariantValue(decoder, VariantTypeId.Int64)).toBe(BigInt(1));
  expect(readVariantValue(decoder, VariantTypeId.UInt64)).toBe(BigInt(1));
  expect(readVariantValue(decoder, VariantTypeId.Float)).toBe(1);
  expect(readVariantValue(decoder, VariantTypeId.Double)).toBe(1);
  expect(readVariantValue(decoder, VariantTypeId.String)).toBe('');
  expect(readVariantValue(decoder, VariantTypeId.DateTime)).toBeInstanceOf(Date);
  expect(readVariantValue(decoder, VariantTypeId.Guid)).toBeInstanceOf(Guid);
  expect(readVariantValue(decoder, VariantTypeId.ByteString)).toBeInstanceOf(Uint8Array);
  expect(readVariantValue(decoder, VariantTypeId.XmlElement)).toBe('');
  expect(readVariantValue(decoder, VariantTypeId.NodeId)).toBeInstanceOf(NodeId);
  expect(readVariantValue(decoder, VariantTypeId.ExpandedNodeId)).toBeInstanceOf(ExpandedNodeId);
  expect(readVariantValue(decoder, VariantTypeId.StatusCode)).toBe(StatusCode.BadInternalError);
  expect(readVariantValue(decoder, VariantTypeId.QualifiedName)).toBeInstanceOf(QualifiedName);
  expect(readVariantValue(decoder, VariantTypeId.LocalizedText)).toBeInstanceOf(LocalizedText);
  expect(readVariantValue(decoder, VariantTypeId.ExtensionObject)).toBeInstanceOf(ExtensionObject);
  expect(readVariantValue(decoder, VariantTypeId.DataValue)).toBeInstanceOf(DataValue);
  expect(readVariantValue(decoder, VariantTypeId.Variant)).toBeInstanceOf(Variant);
  expect(readVariantValue(decoder, VariantTypeId.DiagnosticInfo)).toBeInstanceOf(DiagnosticInfo);

  expect(() => readVariantValue(decoder, 99 as VariantTypeId)).toThrowError(UaError);
});