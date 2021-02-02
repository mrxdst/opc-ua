import { Decodable, Encodable } from './BinaryDataEncoding';
import { RequestHeader, ResponseHeader } from './DataTypes/Generated';
import { ServiceFault } from './DataTypes/ServiceFault';
import * as GeneratedTypes from './DataTypes/Generated';

export type TypedArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Uint8ClampedArray | Float32Array | Float64Array;

export enum OpenState {
  Closed,
  Opening,
  Open,
  Closing
}

export enum SessionState {
  Closed,
  Creating,
  Activating,
  Activated
}

export type Request = Encodable & {
  requestHeader: RequestHeader
};

export type Response = Encodable & {
  responseHeader: ResponseHeader
};

export type EncodableType = ServiceFault | InstanceType<Extract<typeof GeneratedTypes[keyof typeof GeneratedTypes], Decodable>>;

export type DecodableType = typeof ServiceFault | Extract<typeof GeneratedTypes[keyof typeof GeneratedTypes], Decodable>;
