import { BinaryDataDecoder, BinaryDataEncoder } from '../../BinaryDataEncoding.js';
import { UaString } from '../../DataTypes/Primitives.js';
import { StatusCode } from '../../DataTypes/StatusCode.js';
import { decode, encode } from '../../symbols.js';
import { uaStringToByteString } from '../../util.js';

export interface ErrorMessageBodyOptions {
  /** The numeric code for the error. */
  error: StatusCode;
  /** A more verbose description of the error. */
  reason: UaString;
}

export class ErrorMessageBody implements ErrorMessageBodyOptions {
  /** The numeric code for the error. */
  error: StatusCode;
  /** A more verbose description of the error. */
  reason: UaString;

  constructor(options: ErrorMessageBodyOptions) {
    this.error = options.error;
    this.reason = options.reason;
  }

  [encode](encoder: BinaryDataEncoder): void {
    encoder.writeUInt32(this.error.code);
    const bytes = uaStringToByteString(this.reason)?.slice(0, 4096);
    encoder.writeByteString(bytes);
  }

  static [decode](decoder: BinaryDataDecoder): ErrorMessageBody {
    const error = decoder.readType(StatusCode);
    const reason = decoder.readString();

    return new ErrorMessageBody({
      error,
      reason
    });
  }
}