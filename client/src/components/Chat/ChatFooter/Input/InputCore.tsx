import { memo, useCallback, useMemo, useState } from 'react';
import { EditorState, Transaction } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';
import {
  NodeViewComponentProps,
  ProseMirror,
  react,
  ReactNodeViewConstructor,
  useNodeViews,
} from '@nytimes/react-prosemirror';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import * as icons from 'file-icons-js';
import { getFileExtensionForLang } from '../../../../utils';
import { getMentionsPlugin } from './mentionPlugin';
import { addMentionNodes, addTagNodes } from './utils';

const schema = new Schema({
  nodes: addTagNodes(addMentionNodes(basicSchema.spec.nodes)),
  marks: basicSchema.spec.marks,
});

const mentionsData = [
  { tag: 'index.ts' },
  { tag: 'server.rs' },
  { tag: 'component.jsx' },
];

const tagsData = [
  { tag: 'index.ts' },
  { tag: 'server.rs' },
  { tag: 'component.jsx' },
];

/**
 * IMPORTANT: outer div's "suggestion-item-list" class is mandatory. The plugin uses this class for querying.
 * IMPORTANT: inner div's "suggestion-item" class is mandatory too for the same reasons
 */
const getMentionSuggestionsHTML = (items: Record<string, any>[]) => {
  return (
    '<div class="suggestion-item-list rounded border border-bg-border bg-bg-base">' +
    items
      .map(
        (i) =>
          `<div class="suggestion-item flex items-center ${
            icons.getClassWithColor(getFileExtensionForLang(i.display, true)) ||
            icons.getClassWithColor('.txt')
          }">${i.display}</div>`,
      )
      .join('') +
    '</div>'
  );
};

/**
 * IMPORTANT: outer div's "suggestion-item-list" class is mandatory. The plugin uses this class for querying.
 * IMPORTANT: inner div's "suggestion-item" class is mandatory too for the same reasons
 */
const getTagSuggestionsHTML = (items: Record<string, any>[]) => {
  return (
    '<div class="suggestion-item-list">' +
    items
      .map((i) => '<div class="suggestion-item">' + i.tag + '</div>')
      .join('') +
    '</div>'
  );
};

function Paragraph({ children }: NodeViewComponentProps) {
  return <p>{children}</p>;
}

const reactNodeViews: Record<string, ReactNodeViewConstructor> = {
  paragraph: () => ({
    component: Paragraph,
    dom: document.createElement('div'),
    contentDOM: document.createElement('span'),
  }),
};

type Props = {
  getDataLang: (search: string) => Promise<{ id: string; display: string }[]>;
};

const InputCore = ({ getDataLang }: Props) => {
  const mentionPlugin = useMemo(
    () =>
      getMentionsPlugin({
        getSuggestions: async (
          type: string,
          text: string,
          done: (s: Record<string, string>[]) => void,
        ) => {
          const data = await getDataLang(text);
          done(data);
          // setTimeout(() => {
          //   if (type === 'mention') {
          //     done(mentionsData);
          //   } else {
          //     done(tagsData);
          //   }
          // }, 0);
        },
        getSuggestionsHTML: (items, type) => {
          if (type === 'mention') {
            return (
              '<div class="suggestion-item-list rounded border border-bg-border bg-bg-base p-1">' +
              items
                .map(
                  (i) =>
                    `<div class="suggestion-item flex items-center gap-1.5 h-6"><span class="${
                      icons.getClassWithColor(
                        getFileExtensionForLang(i.display, true),
                      ) || icons.getClassWithColor('.txt')
                    } text-left w-4 h-4 file-icon flex items-center flex-shrink-0"></span>${
                      i.display
                    }</div>`,
                )
                .join('') +
              '</div>'
            );
          }
          return getTagSuggestionsHTML(items);
        },
      }),
    [],
  );

  const editorState = useMemo(
    () =>
      EditorState.create({
        doc: schema.topNodeType.create(null, [
          schema.nodes.paragraph.createAndFill()!,
          // schema.nodes.list.createAndFill()!,
        ]),
        schema,
        plugins: [react(), mentionPlugin],
      }),
    [schema, mentionPlugin],
  );
  const { nodeViews, renderNodeViews } = useNodeViews(reactNodeViews);
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  const [state, setState] = useState(editorState);

  const dispatchTransaction = useCallback(
    (tr: Transaction) => setState((oldState) => oldState.apply(tr)),
    [],
  );
  return (
    <div className="w-full py-4.5 leading-[24px] bg-transparent rounded-lg outline-none focus:outline-0 resize-none flex-grow-0 flex flex-col justify-center">
      <ProseMirror
        mount={mount}
        state={state}
        nodeViews={nodeViews}
        dispatchTransaction={dispatchTransaction}
      >
        <div ref={setMount} />
        {renderNodeViews()}
      </ProseMirror>
    </div>
  );
};

export default memo(InputCore);
