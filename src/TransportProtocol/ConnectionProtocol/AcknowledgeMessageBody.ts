import { BinaryDataDecoder, BinaryDataEncoder } from '../../BinaryDataEncoding.js';
import { UInt32 } from '../../DataTypes/Primitives.js';
import { decode, encode } from '../../symbols.js';

export interface AcknowledgeMessageBodyOptions {
  /** The latest version of the UACP protocol supported by the Server. */
  protocolVersion: UInt32;
  /** The largest MessageChunk that the sender can receive. */
  receiveBufferSize: UInt32;
  /** The largest MessageChunk that the sender will send. */
  sendBufferSize: UInt32;
  /** The maximum size for any request Message. */
  maxMessageSize: UInt32;
  /** The maximum number of chunks in any request Message. */
  maxChunkCount: UInt32;
}

export class AcknowledgeMessageBody implements AcknowledgeMessageBodyOptions {
  /** The latest version of the UACP protocol supported by the Server. */
  protocolVersion: UInt32;
  /** The largest MessageChunk that the sender can receive. */
  receiveBufferSize: UInt32;
  /** The largest MessageChunk that the sender will send. */
  sendBufferSize: UInt32;
  /** The maximum size for any request Message. */
  maxMessageSize: UInt32;
  /** The maximum number of chunks in any request Message. */
  maxChunkCount: UInt32;

  constructor(options: AcknowledgeMessageBodyOptions) {
    this.protocolVersion = options.protocolVersion;
    this.receiveBufferSize = options.receiveBufferSize;
    this.sendBufferSize = options.sendBufferSize;
    this.maxMessageSize = options.maxMessageSize;
    this.maxChunkCount = options.maxChunkCount;
  }

  [encode](encoder: BinaryDataEncoder): void {
    encoder.writeUInt32(this.protocolVersion);
    encoder.writeUInt32(this.receiveBufferSize);
    encoder.writeUInt32(this.sendBufferSize);
    encoder.writeUInt32(this.maxMessageSize);
    encoder.writeUInt32(this.maxChunkCount);
  }

  static [decode](decoder: BinaryDataDecoder): AcknowledgeMessageBody {
    const protocolVersion = decoder.readUInt32();
    const receiveBufferSize = decoder.readUInt32();
    const sendBufferSize = decoder.readUInt32();
    const maxMessageSize = decoder.readUInt32();
    const maxChunkCount = decoder.readUInt32();

    return new AcknowledgeMessageBody({
      protocolVersion,
      receiveBufferSize,
      sendBufferSize,
      maxMessageSize,
      maxChunkCount
    });
  }
}