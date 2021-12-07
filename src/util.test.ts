import {
  dateToFileTime,
  fileTimeToDate,
  clampSByte,
  clampByte,
  clampInt16,
  clampUInt16,
  clampInt32,
  clampUInt32,
  clampInt64,
  clampUInt64
} from './util';

test('FileTime', () => {
  expect(dateToFileTime(new Date('1601-01-01T00:00:00Z'))).toBe(BigInt(0));
  expect(dateToFileTime(new Date('1970-01-01T00:00:00Z'))).toBe(BigInt('116444736000000000'));

  expect(fileTimeToDate(BigInt(0)).getTime()).toBe(new Date('1601-01-01T00:00:00Z').getTime());
  expect(fileTimeToDate(BigInt('116444736000000000')).getTime()).toBe(new Date('1970-01-01T00:00:00Z').getTime()); 
});

test('DataTypeConvertion', () => {
  expect(clampSByte(NaN)).toBe(0);
  expect(clampSByte(Infinity)).toBe(2**7-1);
  expect(clampSByte(-Infinity)).toBe(-1*2**7);
  expect(clampSByte(NaN)).toBe(0);
  expect(clampSByte(Number.MAX_VALUE * -1)).toBe(-1*2**7);
  expect(clampByte(Number.MAX_VALUE)).toBe(2**8-1);
  expect(clampInt16(Number.MAX_VALUE * -1)).toBe(-1*2**15);
  expect(clampUInt16(Number.MAX_VALUE)).toBe(2**16-1);
  expect(clampInt32(Number.MAX_VALUE * -1)).toBe(-1*2**31);
  expect(clampUInt32(Number.MAX_VALUE)).toBe(2**32-1);
  expect(clampInt64(BigInt(10))).toBe(BigInt(10));
  expect(clampUInt64(BigInt('0xFFFFFFFFFFFFFFFFF'))).toBe(BigInt('0xFFFFFFFFFFFFFFFF'));
  expect(clampUInt64(BigInt(-10))).toBe(BigInt(0));
});
