import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { decode, encode, typeId } from '../symbols';
import { UaError } from '../UaError';
import { ResponseHeader } from './Generated';
import { NodeIds } from './NodeIds';

export interface ServiceFaultOptions {
  responseHeader: ResponseHeader;
}

/**
 * A fault that occured when calling the service.
 */
export class ServiceFault extends UaError implements ServiceFaultOptions {
  responseHeader: ResponseHeader;

  constructor(options: ServiceFaultOptions) {
    super({code: options.responseHeader.serviceResult});
    this.responseHeader = options.responseHeader;
  }
  
  static [typeId] = NodeIds.ServiceFault_Encoding_DefaultBinary;
  
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
