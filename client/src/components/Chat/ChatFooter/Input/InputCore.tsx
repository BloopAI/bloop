import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import { getFileExtensionForLang, InputEditorContent } from '../../../../utils';
import { getMentionsPlugin } from './mentionPlugin';
import { addMentionNodes, addTagNodes } from './utils';

const schema = new Schema({
  nodes: addTagNodes(addMentionNodes(basicSchema.spec.nodes)),
  marks: basicSchema.spec.marks,
});

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
  initialValue?: Record<string, any> | null;
  onChange: (contents: InputEditorContent[]) => void;
};

const InputCore = ({ getDataLang, initialValue, onChange }: Props) => {
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
        },
        getSuggestionsHTML: (items) => {
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
        },
      }),
    [],
  );

  const { nodeViews, renderNodeViews } = useNodeViews(reactNodeViews);
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  const [state, setState] = useState(
    EditorState.create({
      doc: initialValue ? schema.nodeFromJSON(initialValue) : undefined,
      schema,
      plugins: [react(), mentionPlugin],
    }),
  );

  useEffect(() => {
    if (mount) {
      setState(
        EditorState.create({
          schema,
          plugins: [react(), mentionPlugin],
          doc: initialValue
            ? schema.topNodeType.create(null, [
                schema.nodeFromJSON(initialValue),
              ])
            : undefined,
        }),
      );
    }
  }, [mount, initialValue]);

  const dispatchTransaction = useCallback(
    (tr: Transaction) => setState((oldState) => oldState.apply(tr)),
    [],
  );

  useEffect(() => {
    const newValue = state.toJSON().doc.content[0]?.content;
    onChange(newValue || []);
  }, [state]);

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
