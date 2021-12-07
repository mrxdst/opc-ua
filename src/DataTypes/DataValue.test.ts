import { DataValue } from './DataValue';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { Variant, VariantType, VariantTypeId } from './Variant';
import { StatusCode } from './StatusCode';

test('Encode/Decode', () => {
  const encoder = new BinaryDataEncoder();

  encoder.writeType(new DataValue());
  encoder.writeType(new DataValue({
    value: new Variant({type: VariantType.Scalar, typeId: VariantTypeId.Boolean, value: true}),
    status: StatusCode.BadInternalError
  }));
  encoder.writeType(new DataValue({
    sourceTimestamp: new Date(1),
    serverTimestamp: new Date(2),
    sourcePicoSeconds: 3,
    serverPicoSeconds: 4
  }));

  const decoder = new BinaryDataDecoder(encoder.finish());

  expect(decoder.readType(DataValue).value).toBe(undefined);

  const dv1 = decoder.readType(DataValue);
  expect(dv1.value?.value).toBe(true);
  expect(dv1.status).toBe(StatusCode.BadInternalError);

  const dv2 = decoder.readType(DataValue);
  expect(dv2.sourceTimestamp?.getTime()).toBe(1);
  expect(dv2.serverTimestamp?.getTime()).toBe(2);
  expect(dv2.sourcePicoSeconds).toBe(3);
  expect(dv2.serverPicoSeconds).toBe(4);
});
