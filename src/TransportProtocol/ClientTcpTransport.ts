import PQueue from 'p-queue';
import net from 'net';
import { isNode } from '../util.js';
import { ClientTransportProtocol } from './types.js';
import { UaError } from '../UaError.js';
import { StatusCode } from '../DataTypes/StatusCode.js';

export interface ClientTcpTransportOptions {
  host: string;
  port: number;
  openTimeout: number;
}

export class ClientTcpTransport extends ClientTransportProtocol implements ClientTcpTransportOptions {
  get host(): string { return this.#host; }
  #host: string;
  get port(): number { return this.#port; }
  #port: number;
  openTimeout: number;

  #socket: net.Socket | undefined;
  #openQueue = new PQueue({concurrency: 1});

  constructor (options: ClientTcpTransportOptions) {
    super();
    if (!isNode) {
      throw new UaError({code: StatusCode.BadNotSupported, reason: 'TcpTransportProtocol is only available in node.js'});
    }
    this.#host = options.host;
    this.#port = options.port;
    this.openTimeout = options.openTimeout;
  }

  async open(): Promise<void> {
    return await this.#openQueue.add(async () => {
      if (this.#socket) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({host: this.host, port: this.port});

        const timeout = setTimeout(() => {
          socket.removeListener('connect', onConnect);
          socket.removeListener('error', onError);
          socket.destroy();
          reject(new UaError({code: StatusCode.BadTimeout}));
        }, this.openTimeout);
  
        const onConnect = (): void => {
          clearTimeout(timeout);
          socket.removeListener('error', onError);
          socket.on('error', this.#onError);
          socket.on('close', this.#onClose);
          socket.on('data', this.#onData);
          socket.setKeepAlive(true);
          this.#socket = socket;
          resolve();
        };
    
        const onError = (e: Error): void => {
          clearTimeout(timeout);
          socket.removeListener('connect', onConnect);
          reject(new UaError({code: StatusCode.BadCommunicationError, reason: e.message}));
        };
  
        socket.once('connect', onConnect);
        socket.once('error', onError);
      });
    });
  }

  #onClose = (): void => {
    this.#socket?.removeAllListeners();
    this.#socket?.destroy();
    this.#socket = undefined;
    this.emit('close');
  };

  #onError = (e: Error): void => {
    this.#socket?.removeAllListeners();
    this.#socket?.destroy();
    this.#socket = undefined;
    this.emit('error', new UaError({code: StatusCode.BadCommunicationError, reason: e.message}));
  };

  #onData = (data: Uint8Array): void => {
    this.emit('message', data);
  };

  write(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.#socket) {
        return reject(new UaError({code: StatusCode.BadServerNotConnected}));
      }
      this.#socket.write(data, err => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });    
  }

  close(error?: UaError): void {
    if (!this.#socket) {
      return;
    }
    this.#socket.removeAllListeners();
    this.#socket.destroy();
    this.#socket = undefined;
    if (error) {
      this.emit('error', error);
    }
    this.emit('close');
  }
}