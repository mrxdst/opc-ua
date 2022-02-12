import { Variant, VariantTypeId, readVariantValue, writeVariantValue, VariantType } from './Variant.js';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding.js';
import { Guid } from './Guid.js';
import { NodeId } from './NodeId.js';
import { StatusCode } from './StatusCode.js';
import { ExtensionObject } from './ExtensionObject.js';
import { ExpandedNodeId } from './ExpandedNodeId.js';
import { QualifiedName } from './QualifiedName.js';
import { LocalizedText } from './LocalizedText.js';
import { DataValue } from './DataValue.js';
import { DiagnosticInfo } from './DiagnosticInfo.js';
import ndarray from 'ndarray';

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
});