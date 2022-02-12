import { BinaryDataDecoder, BinaryDataEncoder } from '../../BinaryDataEncoding.js';
import { UaString, UInt32 } from '../../DataTypes/Primitives.js';
import { decode, encode } from '../../symbols.js';

export interface HelloMessageBodyOptions {
  /** The latest version of the UACP protocol supported by the Client. */
  protocolVersion: UInt32;
  /** The largest MessageChunk that the sender can receive. */
  receiveBufferSize: UInt32;
  /** The largest MessageChunk that the sender will send. */
  sendBufferSize: UInt32;
  /** The maximum size for any response Message. */
  maxMessageSize: UInt32;
  /** The maximum number of chunks in any response Message. */
  maxChunkCount: UInt32;
  /** The URL of the Endpoint which the Client wished to connect to. */
  endpointUrl: UaString;
}

export class HelloMessageBody implements HelloMessageBodyOptions {
  /** The latest version of the UACP protocol supported by the Client. */
  protocolVersion: UInt32;
  /** The largest MessageChunk that the sender can receive. */
  receiveBufferSize: UInt32;
  /** The largest MessageChunk that the sender will send. */
  sendBufferSize: UInt32;
  /** The maximum size for any response Message. */
  maxMessageSize: UInt32;
  /** The maximum number of chunks in any response Message. */
  maxChunkCount: UInt32;
  /** The URL of the Endpoint which the Client wished to connect to. */
  endpointUrl: UaString;

  constructor(options: HelloMessageBodyOptions) {
    this.protocolVersion = options.protocolVersion;
    this.receiveBufferSize = options.receiveBufferSize;
    this.sendBufferSize = options.sendBufferSize;
    this.maxMessageSize = options.maxMessageSize;
    this.maxChunkCount = options.maxChunkCount;
    this.endpointUrl = options.endpointUrl;
  }

  [encode](encoder: BinaryDataEncoder): void {
    encoder.writeUInt32(this.protocolVersion);
    encoder.writeUInt32(this.receiveBufferSize);
    encoder.writeUInt32(this.sendBufferSize);
    encoder.writeUInt32(this.maxMessageSize);
    encoder.writeUInt32(this.maxChunkCount);
    encoder.writeString(this.endpointUrl);
  }

  static [decode](decoder: BinaryDataDecoder): HelloMessageBody {
    const protocolVersion = decoder.readUInt32();
    const receiveBufferSize = decoder.readUInt32();
    const sendBufferSize = decoder.readUInt32();
    const maxMessageSize = decoder.readUInt32();
    const maxChunkCount = decoder.readUInt32();
    const endpointUrl = decoder.readString();

    return new HelloMessageBody({
      protocolVersion,
      receiveBufferSize,
      sendBufferSize,
      maxMessageSize,
      maxChunkCount,
      endpointUrl
    });
  }
}