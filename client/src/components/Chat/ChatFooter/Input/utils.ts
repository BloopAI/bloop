import OrderedMap from 'orderedmap';
import { type NodeSpec } from 'prosemirror-model';
import { InputEditorContent } from '../../../../utils';
import { ParsedQueryTypeEnum } from '../../../../types/general';
import { mentionNode } from './nodes';

export function addMentionNodes(nodes: OrderedMap<NodeSpec>) {
  return nodes.append({
    mention: mentionNode,
  });
}

export const mapEditorContentToInputValue = (
  inputState: InputEditorContent[],
) => {
  const getType = (type: string) => (type === 'dir' ? 'path' : type);
  const newValue = inputState
    .map((s) =>
      s.type === 'mention'
        ? `${getType(s.attrs.type)}:${s.attrs.id}`
        : s.text.replaceAll(String.fromCharCode(160), ' '),
    )
    .join('');
  const newValueParsed = inputState.map((s) =>
    s.type === 'mention'
      ? {
          type:
            s.attrs.type === 'lang'
              ? ParsedQueryTypeEnum.LANG
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
