import { QualifiedName } from './QualifiedName.js';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding.js';
import { UaError } from '../UaError.js';

const longName = [...Array<string>(513)].map(() => '.').join('');

test('Encode/Decode', () => {
  const encoder = new BinaryDataEncoder();

  encoder.writeType(new QualifiedName({namespaceIndex: 1, name: 'test'}));
  encoder.writeType(new QualifiedName({namespaceIndex: 1}));
  encoder.writeType(new QualifiedName({namespaceIndex: 0, name: longName}));

  const decoder = new BinaryDataDecoder(encoder.finish());

  expect(decoder.readType(QualifiedName).toString()).toBe('1:test');
  expect(decoder.readType(QualifiedName).toString()).toBe('1:');
  expect(decoder.readType(QualifiedName).toString().length).toBe(512);
});

test('toString', () => {
  expect(new QualifiedName({namespaceIndex: 1, name: 'test'}).toString()).toBe('1:test');
  expect(new QualifiedName({namespaceIndex: 0, name: 'test'}).toString()).toBe('test');
  expect(new QualifiedName({namespaceIndex: 1}).toString()).toBe('1:');
  expect(new QualifiedName({namespaceIndex: 0}).toString()).toBe('');
});

test('parse', () => {
  expect(QualifiedName.parse('1:test').toString()).toBe('1:test');
  expect(QualifiedName.parse('0:test').toString()).toBe('test');
  expect(QualifiedName.parse('1:').toString()).toBe('1:');
  expect(QualifiedName.parse('0:').toString()).toBe('');
  expect(QualifiedName.parse('test').toString()).toBe('test');
  expect(QualifiedName.parse('99999:test').toString()).toBe('99999:test');

  expect(() => QualifiedName.parse(longName).toString()).toThrowError(UaError);
});