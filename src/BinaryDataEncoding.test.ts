import { BinaryDataDecoder, BinaryDataEncoder } from './BinaryDataEncoding';
import { Guid } from './DataTypes/Guid';

test('Encode/Decode', () => {
  

  expect(BinaryDataDecoder.decodeBoolean(BinaryDataEncoder.encodeBoolean(true))).toBe(true);
  expect(BinaryDataDecoder.decodeBoolean(BinaryDataEncoder.encodeBoolean(false))).toBe(false);
  expect(BinaryDataDecoder.decodeSByte(BinaryDataEncoder.encodeSByte(-127))).toBe(-127);
  expect(BinaryDataDecoder.decodeByte(BinaryDataEncoder.encodeByte(255))).toBe(255);
  expect(BinaryDataDecoder.decodeInt16(BinaryDataEncoder.encodeInt16(-1*2**15))).toBe(-1*2**15);
  expect(BinaryDataDecoder.decodeUInt16(BinaryDataEncoder.encodeUInt16(2**16-1))).toBe(2**16-1);
  expect(BinaryDataDecoder.decodeInt32(BinaryDataEncoder.encodeInt32(-1*2**31))).toBe(-1*2**31);
  expect(BinaryDataDecoder.decodeUInt32(BinaryDataEncoder.encodeUInt32(2**32-1))).toBe(2**32-1);
  expect(BinaryDataDecoder.decodeInt64(BinaryDataEncoder.encodeInt64(BigInt(Number.MIN_SAFE_INTEGER)))).toBe(BigInt(Number.MIN_SAFE_INTEGER));
  expect(BinaryDataDecoder.decodeUInt64(BinaryDataEncoder.encodeUInt64(BigInt(Number.MAX_SAFE_INTEGER)))).toBe(BigInt(Number.MAX_SAFE_INTEGER));
  expect(BinaryDataDecoder.decodeFloat(BinaryDataEncoder.encodeFloat(10))).toBe(10);
  expect(BinaryDataDecoder.decodeDouble(BinaryDataEncoder.encodeDouble(Number.MAX_VALUE))).toBe(Number.MAX_VALUE);
  expect(BinaryDataDecoder.decodeByteString(BinaryDataEncoder.encodeByteString(new Uint8Array([0, 127, 255])))).toStrictEqual(new Uint8Array([0, 127, 255]));
  expect(BinaryDataDecoder.decodeString(BinaryDataEncoder.encodeString(undefined))).toBe(undefined);
  expect(BinaryDataDecoder.decodeString(BinaryDataEncoder.encodeString('Test'))).toBe('Test');
  expect(BinaryDataDecoder.decodeDateTime(BinaryDataEncoder.encodeDateTime(new Date('2020-01-01T00:00:00Z')))).toStrictEqual(new Date('2020-01-01T00:00:00Z'));
  expect(BinaryDataDecoder.decodeDateTime(BinaryDataEncoder.encodeDateTime(new Date('0000-01-01T00:00:00Z')))).toStrictEqual(new Date('1601-01-01T00:00:00Z'));
  expect(BinaryDataDecoder.decodeXmlElement(BinaryDataEncoder.encodeXmlElement('<test/>'))).toBe('<test/>');
  expect(BinaryDataDecoder.decodeType(BinaryDataEncoder.encodeType(Guid.parse('72962B91-FA75-4AE6-8D28-B404DC7DAF63')), Guid).toString()).toBe('72962B91-FA75-4AE6-8D28-B404DC7DAF63');
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