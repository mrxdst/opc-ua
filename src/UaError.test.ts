import { UaError } from './UaError.js';
import { StatusCode } from './DataTypes/StatusCode.js';

test('UaError', () => {
  const error = new UaError({code: StatusCode.BadInternalError, reason: undefined});

  expect(error.name).toBe('BadInternalError');
  expect(error.message).toMatch('internal error');
  expect(error.code).toBe(StatusCode.BadInternalError);
});