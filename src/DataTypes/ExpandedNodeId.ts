import { NodeId } from './NodeId.js';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding.js';
import { UaString, UInt32 } from './Primitives.js';
import { decode, encode, namespaceUriFlag, serverIndexFlag, typeId } from '../symbols.js';
import { isUInt32 } from '../util.js';
import { UaError } from '../UaError.js';
import { StatusCode } from './StatusCode.js';
import { NodeIds } from './NodeIds.js';

export interface ExpandedNodeIdOptions {
  nodeId?: NodeId | undefined;
  namespaceUri?: UaString | undefined;
  serverIndex?: UInt32 | undefined;
}

/** An identifier for a node in a UA server address space qualified with a complete namespace string. */
export class ExpandedNodeId implements ExpandedNodeIdOptions {
  readonly nodeId: NodeId;
  readonly namespaceUri: UaString | undefined;
  readonly serverIndex: UInt32;
  
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

    const nodeId = new NodeId({
      ...this.nodeId,
      namespace: 0
    } as NodeId);

    const identifierPart = nodeId.toString();
        
    if (identifierPart === 'Invalid NodeId') {
      return 'Invalid ExpandedNodeId';
    }

    return `${svrPart}nsu=${encodeNamespaceUri(this.namespaceUri)};${identifierPart}`;
  }

  isNull(): boolean {
    return this.nodeId.isNull() &&
    !this.namespaceUri &&
    this.serverIndex === 0;
  }

  toNodeId(namespaceArray: ReadonlyArray<string>): NodeId {
    if (!this.namespaceUri) {
      return this.nodeId;
    }
    
    const index = namespaceArray.indexOf(this.namespaceUri);
    
    if (index === -1) {
      throw new UaError({code: StatusCode.BadInvalidArgument, reason: "NamespaceUri doesn't exist in NamespaceArray"});
    }
    
    const nodeId = new NodeId({
      ...this.nodeId,
      namespace: index
    } as NodeId);

    return nodeId;
  }

  static fromNodeId(nodeId: NodeId, namespaceArray: ReadonlyArray<string>): ExpandedNodeId {
    return nodeId.toExpandedNodeId(namespaceArray);
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

  readonly [typeId] = NodeIds.ExpandedNodeId as const;
  static readonly [typeId] = NodeIds.ExpandedNodeId as const;

  [encode](encoder: BinaryDataEncoder): void {
    const nodeId = new NodeId({
      ...this.nodeId,
      [namespaceUriFlag]: !!this.namespaceUri,
      [serverIndexFlag]: !!this.serverIndex
    } as NodeId);

    encoder.writeType(nodeId);

    if (this.namespaceUri !== undefined) {
      encoder.writeString(this.namespaceUri);
    }
    if (this.serverIndex) {
      encoder.writeUInt32(this.serverIndex);
    }
  }

  static [decode](decoder: BinaryDataDecoder): ExpandedNodeId {
    let nodeId = decoder.readType(NodeId);
    let namespaceUri: UaString;
    let serverIndex: UInt32 | undefined;

    if (nodeId[namespaceUriFlag]) {
      namespaceUri = decoder.readString();
    }
    if (nodeId[serverIndexFlag]) {
      serverIndex = decoder.readUInt32();
    }

    nodeId = new NodeId({
      ...nodeId,
      [namespaceUriFlag]: undefined,
      [serverIndexFlag]: undefined
    } as NodeId);

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