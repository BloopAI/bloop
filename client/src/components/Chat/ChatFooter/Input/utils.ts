import OrderedMap from 'orderedmap';
import { type NodeSpec } from 'prosemirror-model';
import { tagNode, mentionNode } from './nodes';

export function addMentionNodes(nodes: OrderedMap<NodeSpec>) {
  return nodes.append({
    mention: mentionNode,
  });
}

export function addTagNodes(nodes: OrderedMap<NodeSpec>) {
  return nodes.append({
    tag: tagNode,
  });
}
