import { ExpandedNodeId } from './ExpandedNodeId';
import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { NodeId } from './NodeId';

test('Encode/Decode', () => {
  const encoder = new BinaryDataEncoder();

  encoder.writeType(new ExpandedNodeId({nodeId: NodeId.parse('i=1')}));
  encoder.writeType(new ExpandedNodeId({nodeId: NodeId.parse('i=1'), namespaceUri: 'test'}));
  encoder.writeType(new ExpandedNodeId({nodeId: NodeId.parse('i=1'), serverIndex: 1}));

  const decoder = new BinaryDataDecoder(encoder.finish());

  expect(decoder.readType(ExpandedNodeId).nodeId.toString()).toBe('i=1');
  expect(decoder.readType(ExpandedNodeId).namespaceUri).toBe('test');
  expect(decoder.readType(ExpandedNodeId).serverIndex).toBe(1);
});
