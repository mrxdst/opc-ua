import { NodeIdType } from './Generated.js';
import { NodeId, SimpleNodeIdType } from './NodeId.js';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding.js';
import { Guid } from './Guid.js';
import { UaError } from '../UaError.js';

test('NumericNodeId', () => {
  const nodeId = new NodeId({identifierType: NodeIdType.Numeric, value: 0xFF});
  expect(nodeId.identifierType).toBe(NodeIdType.Numeric);
});

test('StringNodeId', () => {
  const nodeId = new NodeId({identifierType: NodeIdType.String, value: 'test'});
  expect(nodeId.identifierType).toBe(NodeIdType.String);
});

test('ByteStringNodeId', () => {
  const nodeId = new NodeId({identifierType: NodeIdType.ByteString, value: new Uint8Array()});
  expect(nodeId.identifierType).toBe(NodeIdType.ByteString);
});

test('GuidNodeId', () => {
  const nodeId = new NodeId({identifierType: NodeIdType.Guid, value: Guid.new()});
  expect(nodeId.identifierType).toBe(NodeIdType.Guid);
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
  encoder.writeType(new NodeId({identifierType: NodeIdType.Numeric, value: 1}));
  encoder.writeType(new NodeId({identifierType: NodeIdType.String, value: 'test'}));
  encoder.writeType(new NodeId({identifierType: NodeIdType.ByteString, value: new Uint8Array([0x74, 0x65, 0x73, 0x74])}));
  encoder.writeType(new NodeId({identifierType: NodeIdType.Guid, value: new Guid()}));

  const decoder = new BinaryDataDecoder(encoder.finish());
  
  expect(decoder.readType(NodeId).toString()).toBe('i=1');
  expect(decoder.readType(NodeId).toString()).toBe('s=test');
  expect(decoder.readType(NodeId).toString()).toBe('b=test');
  expect(decoder.readType(NodeId).toString()).toBe(`g={${new Guid().toString()}}`);
});

test('Invalid throws', () => {
  // @ts-expect-error do not distribute
  expect(() => new NodeId({ identifierType: 255 as SimpleNodeIdType, value: 1})).toThrowError(UaError);
  // @ts-expect-error do not distribute
  expect(() => new NodeId({ identifierType: NodeIdType.String as SimpleNodeIdType, value: 1})).toThrowError(UaError);
  // @ts-expect-error do not distribute
  expect(() => new NodeId({ identifierType: NodeIdType.Numeric as SimpleNodeIdType, value: ''})).toThrowError(UaError);
  // @ts-expect-error do not distribute
  expect(() => new NodeId({ identifierType: NodeIdType.ByteString as SimpleNodeIdType, value: ''})).toThrowError(UaError);
  // @ts-expect-error do not distribute
  expect(() => new NodeId({ identifierType: NodeIdType.Guid as SimpleNodeIdType, value: ''})).toThrowError(UaError);
});

test('toString', () => {
  expect(new NodeId({identifierType: NodeIdType.Numeric, value: 1}).toString()).toBe('i=1');
  expect(new NodeId({identifierType: NodeIdType.Numeric, namespace: 1, value: 1}).toString()).toBe('ns=1;i=1');

  expect(new NodeId({identifierType: NodeIdType.String, value: 'test'}).toString()).toBe('s=test');
  expect(new NodeId({identifierType: NodeIdType.String, namespace: 1, value: 'test'}).toString()).toBe('ns=1;s=test');
  expect(new NodeId({identifierType: NodeIdType.String, value: ''}).toString()).toBe('s=');

  expect(new NodeId({identifierType: NodeIdType.ByteString, value: new Uint8Array([0x74, 0x65, 0x73, 0x74])}).toString()).toBe('b=test');
  expect(new NodeId({identifierType: NodeIdType.ByteString, namespace: 1, value: new Uint8Array([0x74, 0x65, 0x73, 0x74])}).toString()).toBe('ns=1;b=test');
  expect(new NodeId({identifierType: NodeIdType.ByteString, value: undefined}).toString()).toBe('b=');

  expect(new NodeId({identifierType: NodeIdType.Guid, value: Guid.parse('72962B91-FA75-4AE6-8D28-B404DC7DAF63')}).toString()).toBe('g={72962B91-FA75-4AE6-8D28-B404DC7DAF63}');
  expect(new NodeId({identifierType: NodeIdType.Guid, namespace: 1, value: Guid.parse('72962B91-FA75-4AE6-8D28-B404DC7DAF63')}).toString()).toBe('ns=1;g={72962B91-FA75-4AE6-8D28-B404DC7DAF63}');
});

test('StringNodeId Encoding', () => {
  const nodeid = new NodeId({
    identifierType: NodeIdType.String, 
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
  const nodeid = new NodeId({
    identifierType: NodeIdType.Numeric,
    value: 72
  });
  const encoder = new BinaryDataEncoder();
  encoder.writeType(nodeid);
  expect(encoder.finish()).toStrictEqual(new Uint8Array([0x00, 0x48]));
});

test('FourByteNodeId Encoding', () => {
  const nodeid = new NodeId({
    identifierType: NodeIdType.Numeric,
    namespace: 5,
    value: 1025
  });
  const encoder = new BinaryDataEncoder();
  encoder.writeType(nodeid);
  expect(encoder.finish()).toStrictEqual(new Uint8Array([0x01, 0x05, 0x01, 0x04]));
});