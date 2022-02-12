import {
  dateToFileTime,
  fileTimeToDate
} from './util.js';

test('FileTime', () => {
  expect(dateToFileTime(new Date('1601-01-01T00:00:00Z'))).toBe(BigInt(0));
  expect(dateToFileTime(new Date('1970-01-01T00:00:00Z'))).toBe(BigInt('116444736000000000'));

  expect(fileTimeToDate(BigInt(0)).getTime()).toBe(new Date('1601-01-01T00:00:00Z').getTime());
  expect(fileTimeToDate(BigInt('116444736000000000')).getTime()).toBe(new Date('1970-01-01T00:00:00Z').getTime()); 
});
