import { TypedEmitter } from 'tiny-typed-emitter';
import { UaError } from '../UaError.js';

export interface ClientTransportProtocolEvents {
  message: (data: Uint8Array) => void;
  close: () => void;
  error: (error: UaError) => void;
}

export interface ClientTransportProtocol extends TypedEmitter<ClientTransportProtocolEvents> {
  openTimeout: number;
  open(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  close(error?: UaError): void;
}