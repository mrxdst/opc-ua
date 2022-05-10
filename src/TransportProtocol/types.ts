import EventEmitter from 'eventemitter3';
import { UaError } from '../UaError.js';

export interface ClientTransportProtocolEvents {
  message: (data: Uint8Array) => void;
  close: () => void;
  error: (error: UaError) => void;
}

export abstract class ClientTransportProtocol extends EventEmitter<ClientTransportProtocolEvents> {
  abstract openTimeout: number;
  abstract open(): Promise<void>;
  abstract write(data: Uint8Array): Promise<void>;
  abstract close(error?: UaError): void;
}