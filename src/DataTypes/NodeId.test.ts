import { NodeIdType } from './Generated';
import { NodeId, ByteStringNodeId, FourByteNodeId, GuidNodeId, NumericNodeId, StringNodeId, TwoByteNodeId } from './NodeId';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { Guid } from './Guid';
import { UaError } from '../UaError';

test('TwoByteNodeId', () => {
  const stringNodeId = new TwoByteNodeId({value: 8});
  expect(stringNodeId.identifierType).toBe(NodeIdType.TwoByte);
});

test('FourByteNodeId', () => {
  const stringNodeId = new FourByteNodeId({value: 8});
  expect(stringNodeId.identifierType).toBe(NodeIdType.FourByte);
});

test('NumericNodeId', () => {
  const stringNodeId = new NumericNodeId({value: 8});
  expect(stringNodeId.identifierType).toBe(NodeIdType.Numeric);
});

test('StringNodeId', () => {
  const stringNodeId = new StringNodeId({value: 'test'});
  expect(stringNodeId.identifierType).toBe(NodeIdType.String);
});

test('ByteStringNodeId', () => {
  const stringNodeId = new ByteStringNodeId({value: new Uint8Array()});
  expect(stringNodeId.identifierType).toBe(NodeIdType.ByteString);
});

test('GuidNodeId', () => {
  const stringNodeId = new GuidNodeId({value: Guid.new()});
  expect(stringNodeId.identifierType).toBe(NodeIdType.Guid);
});

test('Parse', () => { 
  expect(NodeId.parse('i=0').toString()).toBe('i=0');
  expect(NodeId.parse('ns=1;i=0').toString()).toBe('ns=1;i=0');

  expect(NodeId.parse('s=test').toString()).toBe('s=test');
  expect(NodeId.parse('ns=1;s=test').toString()).toBe('ns=1;s=test');

  expect(NodeId.parse('b=test').toString()).toBe('b=test');
  expect(NodeId.parse('ns=1;b=test').toString()).toBe('ns=1;b=test');

  expect(NodeId.parse('g={72962B91-FA75-4AE6-8D28-B404DC7DAF63}').toString()).toBe('g={72962B91-FA75-4AE6-8D28-B404DC7DAF63}');
  expect(NodeId.parse('ns=1;g={72962B91-FA75-4AE6-8D28-B404DC7DAF63}').toString()).toBe('ns=1;g={72962B91-FA75-4AE6-8D28-B404DC7DAF63}');

  expect(() => NodeId.parse('')).toThrowError(UaError);
  expect(() => NodeId.parse('i=')).toThrowError(UaError);
  expect(() => NodeId.parse('invalid')).toThrowError(UaError);
});

test('Encode/Decode', () => {
  const encoder = new BinaryDataEncoder();
  encoder.writeType(new TwoByteNodeId({value: 1}));
  encoder.writeType(new FourByteNodeId({value: 1}));
  encoder.writeType(new NumericNodeId({value: 1}));
  encoder.writeType(new StringNodeId({value: 'test'}));
  encoder.writeType(new ByteStringNodeId({value: new Uint8Array([0x74, 0x65, 0x73, 0x74])}));
  encoder.writeType(new GuidNodeId({value: new Guid()}));

  const decoder = new BinaryDataDecoder(encoder.finish());
  
  expect(decoder.readType(NodeId).toString()).toBe('i=1');
  expect(decoder.readType(NodeId).toString()).toBe('i=1');
  expect(decoder.readType(NodeId).toString()).toBe('i=1');
  expect(decoder.readType(NodeId).toString()).toBe('s=test');
  expect(decoder.readType(NodeId).toString()).toBe('b=test');
  expect(decoder.readType(NodeId).toString()).toBe(`g={${new Guid().toString()}}`);
});

test('Invalid throws', () => {
  const encoder = new BinaryDataEncoder();
  expect(() => encoder.writeType(new NodeId({identifierType: 255 as NodeIdType, value: 1}))).toThrowError(UaError);
  expect(() => encoder.writeType(new NodeId({identifierType: NodeIdType.String as NodeIdType, value: 1}))).toThrowError(UaError);
  expect(() => encoder.writeType(new NodeId({identifierType: NodeIdType.Numeric as NodeIdType, value: ''}))).toThrowError(UaError);
  expect(() => encoder.writeType(new NodeId({identifierType: NodeIdType.ByteString as NodeIdType, value: ''}))).toThrowError(UaError);
  expect(() => encoder.writeType(new NodeId({identifierType: NodeIdType.Guid as NodeIdType, value: ''}))).toThrowError(UaError);
  
  encoder.writeByte(255);

  const decoder = new BinaryDataDecoder(encoder.finish());
  
  expect(() => decoder.readType(NodeId)).toThrowError(UaError);
});

test('toString', () => {
  expect(new NumericNodeId({value: 1}).toString()).toBe('i=1');
  expect(new NumericNodeId({namespace: 1, value: 1}).toString()).toBe('ns=1;i=1');

  expect(new StringNodeId({value: 'test'}).toString()).toBe('s=test');
  expect(new StringNodeId({namespace: 1, value: 'test'}).toString()).toBe('ns=1;s=test');
  expect(new StringNodeId().toString()).toBe('s=');

  expect(new ByteStringNodeId({value: new Uint8Array([0x74, 0x65, 0x73, 0x74])}).toString()).toBe('b=test');
  expect(new ByteStringNodeId({namespace: 1, value: new Uint8Array([0x74, 0x65, 0x73, 0x74])}).toString()).toBe('ns=1;b=test');
  expect(new ByteStringNodeId().toString()).toBe('b=');

  expect(new GuidNodeId({value: Guid.parse('72962B91-FA75-4AE6-8D28-B404DC7DAF63')}).toString()).toBe('g={72962B91-FA75-4AE6-8D28-B404DC7DAF63}');
  expect(new GuidNodeId({namespace: 1, value: Guid.parse('72962B91-FA75-4AE6-8D28-B404DC7DAF63')}).toString()).toBe('ns=1;g={72962B91-FA75-4AE6-8D28-B404DC7DAF63}');

  expect(new NodeId({identifierType: 255 as NodeIdType, value: 1}).toString()).toBe('Invalid NodeId');
  expect(new NodeId({identifierType: NodeIdType.TwoByte as NodeIdType, value: ''}).toString()).toBe('Invalid NodeId');
  expect(new NodeId({identifierType: NodeIdType.Numeric as NodeIdType, value: ''}).toString()).toBe('Invalid NodeId');
  expect(new NodeId({identifierType: NodeIdType.String as NodeIdType, value: 1}).toString()).toBe('Invalid NodeId');
  expect(new NodeId({identifierType: NodeIdType.ByteString as NodeIdType, value: 1}).toString()).toBe('Invalid NodeId');
  expect(new NodeId({identifierType: NodeIdType.Guid as NodeIdType, value: 1}).toString()).toBe('Invalid NodeId');
});

test('StringNodeId Encoding', () => {
  const nodeid = new StringNodeId({
    namespace: 1,
    value: 'Hot水'
  });
  const encoder = new BinaryDataEncoder();
  encoder.writeType(nodeid);
  expect(encoder.finish()).toStrictEqual(new Uint8Array([
    0x03, 0x01, 0x00,
    0x06, 0x00, 0x00, 0x00,
    0x48, 0x6F, 0x74,
    0xE6, 0xB0, 0xB4
  ]));
});

test('TwoByteNodeId Encoding', () => {
  const nodeid = new TwoByteNodeId({
    value: 72
  });
  const encoder = new BinaryDataEncoder();
  encoder.writeType(nodeid);
  expect(encoder.finish()).toStrictEqual(new Uint8Array([0x00, 0x48]));
});

test('FourByteNodeId Encoding', () => {
  const nodeid = new FourByteNodeId({
    namespace: 5,
    value: 1025
  });
  const encoder = new BinaryDataEncoder();
  encoder.writeType(nodeid);
  expect(encoder.finish()).toStrictEqual(new Uint8Array([0x01, 0x05, 0x01, 0x04]));
});