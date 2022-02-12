import { DiagnosticInfo } from './DiagnosticInfo.js';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding.js';
import { StatusCode } from './StatusCode.js';

test('Encode/Decode', () => {
  const encoder = new BinaryDataEncoder();

  encoder.writeType(new DiagnosticInfo({
    additionalInfo: 'additionalInfo',
    innerDiagnosticInfo: new DiagnosticInfo(),
    innerStatusCode: StatusCode.BadInternalError,
  }));

  encoder.writeType(new DiagnosticInfo({
    locale: 1,
    localizedText: 2,
    namespaceUri: 3,
    symbolicId: 4
  }));

  const decoder = new BinaryDataDecoder(encoder.finish());

  const di1 = decoder.readType(DiagnosticInfo);
  expect(di1.additionalInfo).toBe('additionalInfo');
  expect(di1.innerDiagnosticInfo).toBeInstanceOf(DiagnosticInfo);
  expect(di1.innerStatusCode).toBe(StatusCode.BadInternalError);

  const di2 = decoder.readType(DiagnosticInfo);
  expect(di2.locale).toBe(1);
  expect(di2.localizedText).toBe(2);
  expect(di2.namespaceUri).toBe(3);
  expect(di2.symbolicId).toBe(4);
});
