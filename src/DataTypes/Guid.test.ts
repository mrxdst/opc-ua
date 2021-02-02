import { Guid } from './Guid';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { UaError } from '../UaError';

const testStr = '72962B91-FA75-4AE6-8D28-B404DC7DAF63';

test('toString is same as constructor input', () => {
  const guid = Guid.parse(testStr);
  expect(guid.toString()).toBe(testStr);
});

test('Invalid guid throws', () => {
  expect(() => Guid.parse(testStr.substring(1))).toThrowError(UaError);
});

test('Constructor with data parts give same result', () => {
  const guid1 = Guid.parse(testStr);
  const guid2 = new Guid(guid1);

  expect(guid1.toString()).toBe(guid2.toString());
});

test('new()', () => {
  const guid = Guid.new();
  expect(guid).toBeInstanceOf(Guid);
});

test('empty()', () => {
  const guid = new Guid();
  expect(guid).toBeInstanceOf(Guid);
  expect(guid.toString()).toBe('00000000-0000-0000-0000-000000000000');
});

test('Encode/Decode', () => {
  const encoder = new BinaryDataEncoder();
  const guid = Guid.new();
  encoder.writeType(guid);
  const decoder = new BinaryDataDecoder(encoder.finish());
  expect(decoder.readType(Guid).toString()).toBe(guid.toString());
});

test('Encoding', () => {
  const encoder = new BinaryDataEncoder();
  const guid = Guid.parse(testStr);
  encoder.writeType(guid);
  
  expect(encoder.finish()).toStrictEqual(new Uint8Array([
    0x91, 0x2B, 0x96, 0x72,
    0x75, 0xFA,
    0xE6, 0x4A,
    0x8D, 0x28, 0xB4, 0x04, 0xDC, 0x7D, 0xAF, 0x63
  ]));
});