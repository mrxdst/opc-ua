import { ExtensionObject } from './ExtensionObject';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { NodeId } from './NodeId';
import { UaError } from '../UaError';
import { ThreeDVector } from './Generated';

test('Encode/Decode', () => {
  const encoder = new BinaryDataEncoder();

  encoder.writeType(new ExtensionObject({typeId: NodeId.parse('i=1'), body: 'test'}));
  encoder.writeType(new ExtensionObject({typeId: NodeId.parse('i=1'), body: new Uint8Array([1,2,3])}));
  encoder.writeType(new ExtensionObject({typeId: NodeId.parse('i=1')}));
  encoder.writeType(new ExtensionObject({body: new ThreeDVector({x: 1, y: 2, z: 3})}));
  encoder.writeType(NodeId.parse('i=1'));
  encoder.writeByte(255);

  const decoder = new BinaryDataDecoder(encoder.finish());

  expect(decoder.readType(ExtensionObject).body).toBe('test');
  expect(decoder.readType(ExtensionObject).body).toStrictEqual(new Uint8Array([1,2,3]));
  expect(decoder.readType(ExtensionObject).body).toBe(undefined);
  expect(decoder.readType(ExtensionObject).body).toBeInstanceOf(ThreeDVector);
  expect(() => decoder.readType(ExtensionObject)).toThrowError(UaError);
});
