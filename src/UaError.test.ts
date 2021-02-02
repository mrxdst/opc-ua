import { UaError } from './UaError';
import { StatusCode } from './DataTypes/StatusCode';

test('UaError', () => {
  const error = new UaError({code: StatusCode.BadInternalError, reason: undefined});

  expect(error.name).toBe('BadInternalError');
  expect(error.message).toMatch('internal error');
  expect(error.code).toBe(StatusCode.BadInternalError);
});