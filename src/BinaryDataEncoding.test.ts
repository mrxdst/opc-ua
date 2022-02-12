import { BinaryDataDecoder, BinaryDataEncoder } from './BinaryDataEncoding.js';
import { Guid } from './DataTypes/Guid.js';

test('Encode/Decode', () => {
  const encoder = new BinaryDataEncoder();
  encoder.writeBoolean(true);
  encoder.writeBoolean(false);
  encoder.writeSByte(-127);
  encoder.writeByte(255);
  encoder.writeInt16(-1 * 2 ** 15);
  encoder.writeUInt16(2 ** 16 - 1);
  encoder.writeInt32(-1 * 2 ** 31);
  encoder.writeUInt32(2 ** 32 - 1);
  encoder.writeInt64(BigInt(Number.MIN_SAFE_INTEGER));
  encoder.writeUInt64(BigInt(Number.MAX_SAFE_INTEGER));
  encoder.writeFloat(10);
  encoder.writeDouble(Number.MAX_VALUE);
  encoder.writeByteString(new Uint8Array([0, 127, 255]));
  encoder.writeString(undefined);
  encoder.writeString('Test');
  encoder.writeDateTime(new Date('2020-01-01T00:00:00Z'));
  encoder.writeDateTime(new Date('0000-01-01T00:00:00Z'));
  encoder.writeXmlElement('<test/>');
  encoder.writeType(Guid.parse('72962B91-FA75-4AE6-8D28-B404DC7DAF63'));

  const decoder = new BinaryDataDecoder(encoder.finish());

  expect(decoder.readBoolean()).toBe(true);
  expect(decoder.readBoolean()).toBe(false);
  expect(decoder.readSByte()).toBe(-127);
  expect(decoder.readByte()).toBe(255);
  expect(decoder.readInt16()).toBe(-1*2**15);
  expect(decoder.readUInt16()).toBe(2**16-1);
  expect(decoder.readInt32()).toBe(-1*2**31);
  expect(decoder.readUInt32()).toBe(2**32-1);
  expect(decoder.readInt64()).toBe(BigInt(Number.MIN_SAFE_INTEGER));
  expect(decoder.readUInt64()).toBe(BigInt(Number.MAX_SAFE_INTEGER));
  expect(decoder.readFloat()).toBe(10);
  expect(decoder.readDouble()).toBe(Number.MAX_VALUE);
  expect(decoder.readByteString()).toStrictEqual(new Uint8Array([0, 127, 255]));
  expect(decoder.readString()).toBe(undefined);
  expect(decoder.readString()).toBe('Test');
  expect(decoder.readDateTime()).toStrictEqual(new Date('2020-01-01T00:00:00Z'));
  expect(decoder.readDateTime()).toStrictEqual(new Date('1601-01-01T00:00:00Z'));
  expect(decoder.readXmlElement()).toBe('<test/>');
  expect(decoder.readType(Guid).toString()).toBe('72962B91-FA75-4AE6-8D28-B404DC7DAF63');
});

test('Integer encoding', () => {
  const encoder = new BinaryDataEncoder();
  encoder.writeInt32(1_000_000_000);
  expect(encoder.finish()).toStrictEqual(new Uint8Array([0x00, 0xCA, 0x9A, 0x3B]));
});

test('Float encoding', () => {
  const encoder = new BinaryDataEncoder();
  encoder.writeFloat(-6.5);
  expect(encoder.finish()).toStrictEqual(new Uint8Array([0x00, 0x00, 0xD0, 0xC0]));
});

test('String encoding', () => {
  const encoder = new BinaryDataEncoder();
  encoder.writeString('水Boy');
  expect(encoder.finish()).toStrictEqual(new Uint8Array([0x06, 0x00, 0x00, 0x00, 0xE6, 0xB0, 0xB4, 0x42, 0x6F, 0x79]));
});

test('XmlElement encoding', () => {
  const encoder = new BinaryDataEncoder();
  encoder.writeXmlElement('<A>Hot水</A>');
  expect(encoder.finish()).toStrictEqual(new Uint8Array([
    0x0D, 0x00, 0x00, 0x00,
    0x3C, 0x41, 0x3E,
    0x48, 0x6F, 0x74,
    0xE6, 0xB0, 0xB4,
    0x3C, 0x2F, 0x41, 0x3E
  ]));
});