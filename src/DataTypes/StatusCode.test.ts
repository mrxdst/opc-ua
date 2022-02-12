import { StatusCode } from './StatusCode.js';

test('statusCodeSeverity', () => {
  expect(StatusCode.BadInternalError.isGood()).toBe(false);
  expect(StatusCode.BadInternalError.isUncertain()).toBe(false);
  expect(StatusCode.BadInternalError.isBad()).toBe(true);
});