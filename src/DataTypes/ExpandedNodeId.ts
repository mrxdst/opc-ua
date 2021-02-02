import { NodeId } from './NodeId';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { UaString, UInt32 } from './Primitives';
import { decode, encode, namespaceUriFlag, serverIndexFlag } from '../symbols';
import { isUInt32 } from '../util';
import { UaError } from '../UaError';
import { StatusCode } from './StatusCode';

export interface ExpandedNodeIdOptions {
  nodeId?: NodeId;
  namespaceUri?: UaString;
  serverIndex?: UInt32;
}

/** An identifier for a node in a UA server address space qualified with a complete namespace string. */
export class ExpandedNodeId implements ExpandedNodeIdOptions {
  nodeId: NodeId;
  namespaceUri?: UaString;
  serverIndex: UInt32;
  
  constructor(options?: ExpandedNodeIdOptions) {
    this.nodeId = options?.nodeId ?? NodeId.null();
    this.namespaceUri = options?.namespaceUri;
    this.serverIndex = options?.serverIndex ?? 0;
  }

  toString(): string {
    if (!isUInt32(this.serverIndex)) {
      return 'Invalid ExpandedNodeId';
    }
    
    const svrPart = this.serverIndex !== 0 ? `svr=${this.serverIndex};` : '';

    if (!this.namespaceUri) {
      const text = this.nodeId.toString();
      if (text === 'Invalid NodeId') {
        return 'Invalid ExpandedNodeId';
      }
      return `${svrPart}${text}`;
    }

    const _ns = this.nodeId.namespace;
    this.nodeId.namespace = 0;
    let identifierPart: string;
    try {
      identifierPart = this.nodeId.toString();
    } finally {
      this.nodeId.namespace = _ns;
    }
    
    if (identifierPart === 'Invalid NodeId') {
      return 'Invalid ExpandedNodeId';
    }

    return `${svrPart}nsu=${encodeNamespaceUri(this.namespaceUri)};${identifierPart}`;
  }

  toNodeId(namespaceArray: string[]): NodeId {
    if (!this.namespaceUri) {
      return this.nodeId;
    }

    const _nodeId = new NodeId(this.nodeId);
    
    const index = namespaceArray.indexOf(this.namespaceUri);

    if (index === -1) {
      throw new UaError({code: StatusCode.BadInvalidArgument, reason: "NamespaceUri doesn't exist in NamespaceArray"});
    }

    _nodeId.namespace = index;

    return _nodeId;
  }

  /** Parses the string to a ExpandedNodeId. */
  static parse(str: string): ExpandedNodeId {
    let serverIndex: UInt32 = 0;
    let namespaceUri: UaString;
    let nodeId: NodeId | undefined;

    const svrMatch = /^svr=(\d+);(.+)$/.exec(str);
    if (svrMatch) {
      serverIndex = parseInt(svrMatch[1] as string);
      if (!isUInt32(serverIndex)) {
        throw new UaError({code: StatusCode.BadNodeIdInvalid, reason: 'ServerIndex out of range'});
      }
      str = svrMatch[2] as string;
    }

    const nsuMatch = /^nsu=(.+);(.+)$/.exec(str);
    if (nsuMatch) {
      namespaceUri = decodeNamespaceUri(nsuMatch[1] as string);
      nodeId = NodeId.parse(nsuMatch[2] as string);
      if (nodeId.namespace !== 0) {
        throw new UaError({code: StatusCode.BadNodeIdInvalid});
      }
    } else {
      nodeId = NodeId.parse(str);
    }

    return new ExpandedNodeId({
      nodeId,
      namespaceUri,
      serverIndex
    });
  }

  [encode](encoder: BinaryDataEncoder): void {
    const nodeId = new NodeId(this.nodeId);
    nodeId[namespaceUriFlag] = this.namespaceUri !== undefined;
    nodeId[serverIndexFlag] = !!this.serverIndex;

    try {
      encoder.writeType(nodeId);
    } finally {
      nodeId[namespaceUriFlag] = undefined;
      nodeId[serverIndexFlag] = undefined;
    }

    if (this.namespaceUri !== undefined) {
      encoder.writeString(this.namespaceUri);
    }
    if (this.serverIndex) {
      encoder.writeUInt32(this.serverIndex);
    }
  }

  static [decode](decoder: BinaryDataDecoder): ExpandedNodeId {
    const nodeId = decoder.readType(NodeId);
    let namespaceUri: UaString;
    let serverIndex: UInt32 | undefined;

    if (nodeId[namespaceUriFlag]) {
      namespaceUri = decoder.readString();
    }
    if (nodeId[serverIndexFlag]) {
      serverIndex = decoder.readUInt32();
    }

    nodeId[namespaceUriFlag] = undefined;
    nodeId[serverIndexFlag] = undefined;

    return new ExpandedNodeId({
      nodeId,
      namespaceUri,
      serverIndex
    });
  }
}

function encodeNamespaceUri(namespaceUri: string): string {
  return namespaceUri.replace(/;/g, '%3B').replace(/%/g, '%25');
}

function decodeNamespaceUri(namespaceUri: string): string {
  return namespaceUri.replace(/%3B/gi, ';').replace(/%25/gi, '%');
}