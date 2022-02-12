import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding.js';
import { ByteString, UaString, UInt32 } from '../DataTypes/Primitives.js';
import { StatusCode } from '../DataTypes/StatusCode.js';
import { decode, encode } from '../symbols.js';
import { UaError } from '../UaError.js';


export enum MessageType {
  /** A Message secured with the keys associated with a channel. */
  MSG = 'MSG',
  /** OpenSecureChannel Message. */
  OPN = 'OPN',
  /** CloseSecureChannel Message. */
  CLO = 'CLO'
}

export enum IsFinal {
  /** An intermediate chunk. */
  C = 'C',
  /** The final chunk. */
  F = 'F',
  /** The final chunk (used when an error occurred and the Message is aborted). */
  A = 'A'
}

export interface MessageOptions {
  /** A three byte ASCII code that identifies the Message type. */
  messageType: MessageType;
  /** Indicates whether the MessageChunk is the final chunk in a Message. */
  isFinal: IsFinal;
  /** A unique identifier for the SecureChannel assigned by the Server. */
  secureChannelId: UInt32;
  /** A unique identifier for the SecureChannel SecurityToken used to secure the Message. */
  tokenId?: UInt32 | undefined;
  /** The URI of the Security Policy used to secure the Message. */
  securityPolicyUri?: UaString | undefined;
  /** The X.509 v3 Certificate assigned to the sending application Instance. */
  senderCertificate?: ByteString | undefined;
  /** The thumbprint of the X.509 v3 Certificate assigned to the receiving application Instance. */
  receiverCertificateThumbprint?: ByteString | undefined;
  /** A monotonically increasing sequence number assigned by the sender to each MessageChunk sent over the SecureChannel. */
  sequenceNumber: UInt32;
  /** An identifier assigned by the Client to OPC UA request Message. All MessageChunks for the request and the associated response use the same identifier. */
  requestId: UInt32;
  /** The request body. */
  body: Uint8Array;
}

export class Message implements MessageOptions {
  /** A three byte ASCII code that identifies the Message type. */
  messageType: MessageType;
  /** Indicates whether the MessageChunk is the final chunk in a Message. */
  isFinal: IsFinal;
  /** A unique identifier for the SecureChannel assigned by the Server. */
  secureChannelId: UInt32;
  /** A unique identifier for the SecureChannel SecurityToken used to secure the Message. */
  tokenId: UInt32 | undefined;
  /** The URI of the Security Policy used to secure the Message. */
  securityPolicyUri: UaString | undefined;
  /** The X.509 v3 Certificate assigned to the sending application Instance. */
  senderCertificate: ByteString | undefined;
  /** The thumbprint of the X.509 v3 Certificate assigned to the receiving application Instance. */
  receiverCertificateThumbprint: ByteString | undefined;
  /** A monotonically increasing sequence number assigned by the sender to each MessageChunk sent over the SecureChannel. */
  sequenceNumber: UInt32;
  /** An identifier assigned by the Client to OPC UA request Message. All MessageChunks for the request and the associated response use the same identifier. */
  requestId: UInt32;
  /** The request body. */
  body: Uint8Array;

  constructor(options: MessageOptions) {
    this.messageType = options.messageType;
    this.isFinal = options.isFinal;
    this.secureChannelId = options.secureChannelId;
    this.tokenId = options.tokenId;
    this.securityPolicyUri = options.securityPolicyUri;
    this.senderCertificate = options.senderCertificate;
    this.receiverCertificateThumbprint = options.receiverCertificateThumbprint;
    this.sequenceNumber = options.sequenceNumber;
    this.requestId = options.requestId;
    this.body = options.body;
  }

  [encode](encoder: BinaryDataEncoder): void {
    const encoder2 = new BinaryDataEncoder();
    encoder2.writeFixedLengthString(this.messageType);
    if (this.messageType !== MessageType.MSG && this.isFinal !== IsFinal.F) {
      throw new UaError({code: StatusCode.BadEncodingError, reason: `Invalid IsFinal=${IsFinal[this.isFinal]} for MessageType=${MessageType[this.messageType]}`});
    }
    encoder2.writeFixedLengthString(this.isFinal);
    encoder2.writeUInt32(0); // Temporary
    encoder2.writeUInt32(this.secureChannelId);
    if (this.messageType === MessageType.OPN) {
      encoder2.writeString(this.securityPolicyUri);
      encoder2.writeByteString(this.senderCertificate);
      encoder2.writeByteString(this.receiverCertificateThumbprint);
    } else {
      if (this.tokenId === undefined) {
        throw new UaError({code: StatusCode.BadEncodingError, reason: `TokenId is required for MessageType=${MessageType[this.messageType]}`});
      }
      encoder2.writeUInt32(this.tokenId);
    }
    encoder2.writeUInt32(this.sequenceNumber);
    encoder2.writeUInt32(this.requestId);
    encoder2.writeBytes(this.body);

    const data = encoder2.finish();
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    dv.setUint32(4, data.byteLength, true);

    encoder.writeBytes(data);
  }

  static [decode](decoder: BinaryDataDecoder): Message {
    const initialyDecodedBytes = decoder.decodedBytes;
    const messageType = decoder.readFixedLengthString(3) as MessageType;
    if (!MessageType[messageType]) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid MessageType'});
    }
    const isFinal = decoder.readFixedLengthString(1) as IsFinal;
    if (!IsFinal[isFinal]) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: 'Invalid IsFinal'});
    }
    if (messageType !== MessageType.MSG && isFinal !== IsFinal.F) {
      throw new UaError({code: StatusCode.BadDecodingError, reason: `Invalid IsFinal=${IsFinal[isFinal]} for MessageType=${MessageType[messageType]}`});
    }
    const messageSize = decoder.readUInt32();
    const secureChannelId = decoder.readUInt32();

    let securityPolicyUri: UaString;
    let senderCertificate: ByteString;
    let receiverCertificateThumbprint: ByteString;
    let tokenId: UInt32 | undefined;

    if (messageType === MessageType.OPN) {
      securityPolicyUri = decoder.readString();
      senderCertificate = decoder.readByteString();
      receiverCertificateThumbprint = decoder.readByteString();
    } else {
      tokenId = decoder.readUInt32();
    }

    const sequenceNumber = decoder.readUInt32();
    const requestId = decoder.readUInt32();

    const body = decoder.readBytes(messageSize - decoder.decodedBytes - initialyDecodedBytes);

    return new Message({
      messageType,
      isFinal,
      secureChannelId,
      securityPolicyUri,
      senderCertificate,
      receiverCertificateThumbprint,
      tokenId,
      sequenceNumber,
      requestId,
      body
    });
  }
}