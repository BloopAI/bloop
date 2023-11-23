import OrderedMap from 'orderedmap';
import { type NodeSpec } from 'prosemirror-model';
import { mentionNode } from './nodes';

export function addMentionNodes(nodes: OrderedMap<NodeSpec>) {
  return nodes.append({
    mention: mentionNode,
  });
}
