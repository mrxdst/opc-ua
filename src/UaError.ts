import { UaString } from './DataTypes/Primitives';
import { StatusCode } from './DataTypes/StatusCode';

export interface UaErrorOptions {
  /** The StatusCode for the error. */
  code: StatusCode;
  /** A more verbose description of the error. */
  reason?: UaString;
}

/** An Error with a StatusCode and reason. */
export class UaError extends Error implements UaErrorOptions {
  /** The StatusCode for the error. */
  get code(): StatusCode { return this.#code; }
  #code: StatusCode;
  /** A more verbose description of the error. */
  get reason(): UaString { return this.#reason; }
  #reason: UaString;
  
  constructor(options: UaErrorOptions) {
    super(options.code.description || options.code.toString());
    this.name = options.code.toString();

    this.#code = options.code;
    this.#reason = options.reason;
  }
}