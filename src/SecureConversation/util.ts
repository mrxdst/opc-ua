import { BinaryDataDecoder } from '../BinaryDataEncoding';

export function chunkBody(options: {
  body: Uint8Array;
  messageChunkSize: number;
}): Uint8Array[] {
  const maxBodySize = options.messageChunkSize - 12 - 4 - 8;
  const body = options.body;

  const bodyDecoder = new BinaryDataDecoder(body);
  const bodyChunks: Uint8Array[] = [];

  while (bodyDecoder.bytesLeft) {
    bodyChunks.push(bodyDecoder.readBytes(Math.min(maxBodySize, bodyDecoder.bytesLeft)));
  }

  return bodyChunks;
}