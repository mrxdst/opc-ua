import PQueue from 'p-queue';
import { TypedEmitter } from 'tiny-typed-emitter';
import ws from 'ws';
import { isBrowser } from '../util.js';
import { ClientTransportProtocol, ClientTransportProtocolEvents } from './types.js';
import { UaError } from '../UaError.js';
import { StatusCode } from '../DataTypes/StatusCode.js';

const WebSocket = (isBrowser ? window.WebSocket : ws as unknown as typeof window.WebSocket);

export interface ClientWssTransportOptions {
  url: string;
  openTimeout: number;
}

interface ErrorEvent {
  message: string;
}

export class ClientWssTransport extends TypedEmitter<ClientTransportProtocolEvents> implements ClientTransportProtocol, ClientWssTransportOptions {
  get url(): string { return this.#url; }
  #url: string;
  openTimeout: number;

  #socket: WebSocket | undefined;
  #openQueue = new PQueue({concurrency: 1});

  constructor (options: ClientWssTransportOptions) {
    super();
    this.#url = options.url;
    this.openTimeout = options.openTimeout;
  }

  async open(): Promise<void> {
    return await this.#openQueue.add(async () => {
      if (this.#socket) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(this.url);
        socket.binaryType = 'arraybuffer';

        const timeout = setTimeout(() => {
          socket.removeEventListener('connect', onConnect);
          socket.removeEventListener('error', onError);
          socket.close();
          reject(new UaError({code: StatusCode.BadTimeout}));
        }, this.openTimeout);
  
        const onConnect = (): void => {
          clearTimeout(timeout);
          socket.removeEventListener('error', onError);
          socket.addEventListener('error', this.#onError);
          socket.addEventListener('close', this.#onClose);
          socket.addEventListener('message', this.#onMessage);
          this.#socket = socket;
          resolve();
        };
    
        const onError = (event: Event | ErrorEvent): void => {
          clearTimeout(timeout);
          socket.removeEventListener('connect', onConnect);
          reject(new UaError({code: StatusCode.BadCommunicationError, reason: 'message' in event ? event.message : undefined}));
        };
  
        socket.addEventListener('open', onConnect);
        socket.addEventListener('error', onError);
      });
    });
  }

  #onClose = (): void => {
    this.#socket?.removeEventListener('close', this.#onClose);
    this.#socket?.removeEventListener('error', this.#onError);
    this.#socket?.removeEventListener('message', this.#onMessage);
    this.#socket = undefined;
    this.emit('close');
  };

  #onError = (event: Event | ErrorEvent): void => {
    this.#socket?.removeEventListener('close', this.#onClose);
    this.#socket?.removeEventListener('error', this.#onError);
    this.#socket?.removeEventListener('message', this.#onMessage);
    this.#socket = undefined;
    const e = new UaError({code: StatusCode.BadCommunicationError, reason: 'message' in event ? event.message : undefined});
    this.emit('error', e);
  };

  #onMessage = (event: Event): void => {
    const data = new Uint8Array((event as MessageEvent<number>).data);
    this.emit('message', data);
  };

  write(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.#socket) {
        return reject(new UaError({code: StatusCode.BadServerNotConnected}));
      }

      try {
        this.#socket.send(data);
      } catch (e) {
        return reject(e);
      }

      return resolve();
    });    
  }

  close(error?: UaError): void {
    if (!this.#socket) {
      return;
    }
    this.#socket.removeEventListener('close', this.#onClose);
    this.#socket.removeEventListener('error', this.#onError);
    this.#socket.removeEventListener('message', this.#onMessage);
    this.#socket.close();
    this.#socket = undefined;
    if (error) {
      this.emit('error', error);
    }
    this.emit('close');
  }
}