import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { EditorState, Transaction } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
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
import { addMentionNodes } from './utils';
import { placeholderPlugin } from './placeholderPlugin';

const schema = new Schema({
  nodes: addMentionNodes(basicSchema.spec.nodes),
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
  onSubmit?: (s: string) => void;
  placeholder: string;
};

const InputCore = ({
  getDataLang,
  initialValue,
  onChange,
  onSubmit,
  placeholder,
}: Props) => {
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

  const plugins = useMemo(() => {
    return [
      keymap({
        ...baseKeymap,
        Enter: (state) => {
          const key = Object.keys(state).find((k) =>
            k.startsWith('autosuggestions'),
          );
          // @ts-ignore
          if (key && state[key]?.active) {
            return false;
          }
          console.log('submit', state);
          onSubmit?.(
            state
              .toJSON()
              .doc.content[0]?.content.map((s: InputEditorContent) =>
                s.type === 'mention' ? `${s.attrs.type}:${s.attrs.id}` : s.text,
              )
              .join(''),
          );
          return true;
        },
        'Ctrl-Enter': baseKeymap.Enter,
        'Cmd-Enter': baseKeymap.Enter,
      }),
      placeholderPlugin(placeholder),
      react(),
      mentionPlugin,
    ];
  }, [onSubmit]);

  const { nodeViews, renderNodeViews } = useNodeViews(reactNodeViews);
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  const [state, setState] = useState(
    EditorState.create({
      doc: initialValue ? schema.nodeFromJSON(initialValue) : undefined,
      schema,
      plugins,
    }),
  );

  useEffect(() => {
    if (mount) {
      setState(
        EditorState.create({
          schema,
          plugins,
          doc: initialValue
            ? schema.topNodeType.create(null, [
                schema.nodeFromJSON(initialValue),
              ])
            : undefined,
        }),
      );
    }
  }, [mount, initialValue, plugins]);

  const dispatchTransaction = useCallback(
    (tr: Transaction) => setState((oldState) => oldState.apply(tr)),
    [],
  );

  useEffect(() => {
    const newValue = state.toJSON().doc.content[0]?.content;
    onChange(newValue || []);
  }, [state]);

  return (
    <div className="w-full py-4 leading-[24px] bg-transparent rounded-lg outline-none focus:outline-0 resize-none flex-grow-0 flex flex-col justify-center">
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
