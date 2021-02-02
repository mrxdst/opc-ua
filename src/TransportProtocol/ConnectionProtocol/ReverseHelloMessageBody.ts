import { BinaryDataDecoder, BinaryDataEncoder } from '../../BinaryDataEncoding';
import { UaString } from '../../DataTypes/Primitives';
import { decode, encode } from '../../symbols';
import { uaStringToByteString } from '../../util';

export interface ReverseHelloMessageBodyOptions {
  /** The ApplicationUri of the Server which sent the Message. */
  serverUri: UaString;
  /** The URL of the Endpoint which the Client uses when establishing the SecureChannel. */
  endpointUrl: UaString;
}

export class ReverseHelloMessageBody implements ReverseHelloMessageBodyOptions {
  /** The ApplicationUri of the Server which sent the Message. */
  serverUri: UaString;
  /** The URL of the Endpoint which the Client uses when establishing the SecureChannel. */
  endpointUrl: UaString;

  constructor(options: ReverseHelloMessageBodyOptions) {
    this.serverUri = options.serverUri;
    this.endpointUrl = options.endpointUrl;
  }

  [encode](encoder: BinaryDataEncoder): void {
    encoder.writeByteString(uaStringToByteString(this.serverUri)?.slice(0, 4096));
    encoder.writeByteString(uaStringToByteString(this.endpointUrl)?.slice(0, 4096));
  }

  static [decode](decoder: BinaryDataDecoder): ReverseHelloMessageBody {
    const serverUri = decoder.readString();
    const endpointUrl = decoder.readString();

    return new ReverseHelloMessageBody({
      serverUri,
      endpointUrl
    });
  }
}