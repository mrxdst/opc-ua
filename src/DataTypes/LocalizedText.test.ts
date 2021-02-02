import { LocalizedText } from './LocalizedText';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';

test('Encode/Decode', () => {
  const encoder = new BinaryDataEncoder();

  encoder.writeType(new LocalizedText({text: 'test'}));
  encoder.writeType(new LocalizedText({locale: 'en', text: 'test'}));
  encoder.writeType(new LocalizedText({locale: 'en'}));
  encoder.writeType(new LocalizedText());

  const decoder = new BinaryDataDecoder(encoder.finish());

  expect(decoder.readType(LocalizedText).text).toBe('test');
  expect(decoder.readType(LocalizedText).locale).toBe('en');
  expect(decoder.readType(LocalizedText).locale).toBe('en');
  expect(decoder.readType(LocalizedText).text).toBe(undefined);
});
