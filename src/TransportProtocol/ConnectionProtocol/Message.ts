import { BinaryDataDecoder, BinaryDataEncoder, Encodable } from '../../BinaryDataEncoding.js';
import { StatusCode } from '../../DataTypes/StatusCode.js';
import { decode, encode } from '../../symbols.js';
import { UaError } from '../../UaError.js';
import { AcknowledgeMessageBody } from './AcknowledgeMessageBody.js';
import { ErrorMessageBody } from './ErrorMessageBody.js';
import { HelloMessageBody } from './HelloMessageBody.js';
import { ReverseHelloMessageBody } from './ReverseHelloMessageBody.js';

export enum MessageType {
  /** Hello Message. */
  HEL = 'HEL',
  /** Acknowledge Message. */
  ACK = 'ACK',
  /** Error Message. */
  ERR = 'ERR',
  /** ReverseHello Message. */
  RHE = 'RHE'
}

export interface MessageOptions {
  /** A three byte ASCII code that identifies the Message type. */
  messageType: MessageType;
  body: Encodable;
}

export class Message implements MessageOptions {
  /** A three byte ASCII code that identifies the Message type. */
  messageType: MessageType;
  body: Encodable;

  constructor(options: MessageOptions) {
    this.messageType = options.messageType;
    this.body = options.body;
  }

  [encode](encoder: BinaryDataEncoder): void {
    encoder.writeFixedLengthString(this.messageType);
    encoder.writeFixedLengthString('F');
    const body = BinaryDataEncoder.encodeType(this.body);
    encoder.writeUInt32(body.byteLength + 8);
    encoder.writeBytes(body);
  }

  static [decode](decoder: BinaryDataDecoder): Message {
    const messageType = decoder.readFixedLengthString(3) as MessageType;
    if (!MessageType[messageType]) {
      throw new UaError({code: StatusCode.BadDecodingError});
    }
    const isFinal = decoder.readFixedLengthString(1);
    if (isFinal !== 'F') {
      throw new UaError({code: StatusCode.BadDecodingError});
    }
    const messageSize = decoder.readUInt32();

    const bodyBytes = decoder.readBytes(messageSize - 8);

    let body: Encodable;

    switch (messageType) {
      case MessageType.ACK: {
        body = BinaryDataDecoder.decodeType(bodyBytes, AcknowledgeMessageBody);
        break;
      }
      case MessageType.ERR: {
        body = BinaryDataDecoder.decodeType(bodyBytes, ErrorMessageBody);
        break;
      }
      case MessageType.HEL: {
        body = BinaryDataDecoder.decodeType(bodyBytes, HelloMessageBody);
        break;
      }
      case MessageType.RHE: {
        body = BinaryDataDecoder.decodeType(bodyBytes, ReverseHelloMessageBody);
        break;
      }
    }

    return new Message({
      messageType,
      body
    });
  }
}