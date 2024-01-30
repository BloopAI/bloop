import OrderedMap from 'orderedmap';
import { type NodeSpec } from 'prosemirror-model';
import {
  InputEditorContent,
  ParsedQueryTypeEnum,
} from '../../../../types/general';
import { mentionNode } from './nodes';

export function addMentionNodes(nodes: OrderedMap<NodeSpec>) {
  return nodes.append({
    mention: mentionNode,
  });
}

export const mapEditorContentToInputValue = (
  inputState: InputEditorContent[],
) => {
  const getType = (type: string) =>
    type === 'lang' || type === 'repo' ? type : 'path';
  const newValue = inputState
    .map((s) =>
      s.type === 'mention'
        ? `${getType(s.attrs.type)}:${s.attrs.id}`
        : s.type === 'text'
        ? s.text?.replace(new RegExp(String.fromCharCode(160), 'g'), ' ')
        : '',
    )
    .join('');
  const newValueParsed = inputState.map((s) =>
    s.type === 'mention'
      ? {
          type:
            s.attrs.type === 'lang'
              ? ParsedQueryTypeEnum.LANG
              : s.attrs.type === 'repo'
              ? ParsedQueryTypeEnum.REPO
              : ParsedQueryTypeEnum.PATH,
          text: s.attrs.id,
        }
      : { type: ParsedQueryTypeEnum.TEXT, text: s.text },
  );
  return {
    plain: newValue,
    parsed: newValueParsed,
  };
};
