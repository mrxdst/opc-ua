import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding.js';
import { decode, encode, typeId } from '../symbols.js';
import { UaError } from '../UaError.js';
import { ResponseHeader } from './Generated.js';
import { NodeIds } from './NodeIds.js';

export interface ServiceFaultOptions {
  responseHeader: ResponseHeader;
}

/**
 * A fault that occured when calling the service.
 */
export class ServiceFault extends UaError implements ServiceFaultOptions {
  readonly responseHeader: ResponseHeader;

  constructor(options: ServiceFaultOptions) {
    super({code: options.responseHeader.serviceResult});
    this.responseHeader = options.responseHeader;
  }
  
  readonly [typeId] = NodeIds.ServiceFault_Encoding_DefaultBinary as const;
  static readonly [typeId] = NodeIds.ServiceFault_Encoding_DefaultBinary as const;
  
  [encode](encoder: BinaryDataEncoder): void {
    encoder.writeType(this.responseHeader);
  }

  static [decode](decoder: BinaryDataDecoder): ServiceFault {
    const responseHeader = decoder.readType(ResponseHeader);
    return new ServiceFault({
      responseHeader
    });
  }
}
