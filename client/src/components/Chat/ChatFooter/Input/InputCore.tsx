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
import { useTranslation } from 'react-i18next';
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
  getDataPath: (search: string) => Promise<{ id: string; display: string }[]>;
  initialValue?: Record<string, any> | null;
  onChange: (contents: InputEditorContent[]) => void;
  onSubmit?: (s: string) => void;
  placeholder: string;
};

const InputCore = ({
  getDataLang,
  getDataPath,
  initialValue,
  onChange,
  onSubmit,
  placeholder,
}: Props) => {
  const { t } = useTranslation();
  const mentionPlugin = useMemo(
    () =>
      getMentionsPlugin({
        getSuggestions: async (
          type: string,
          text: string,
          done: (s: Record<string, string>[]) => void,
        ) => {
          const data = await Promise.all([
            getDataPath(text),
            getDataLang(text),
          ]);
          done([...data[0], ...data[1]]);
        },
        getSuggestionsHTML: (items) => {
          return (
            '<div class="suggestion-item-list rounded-md border border-chat-bg-border p-1 shadow-high max-h-[500px] overflow-auto bg-chat-bg-shade">' +
            items
              .map(
                (i) =>
                  `<div>${
                    i.isFirst
                      ? `<div class="flex items-center gap-2 px-2 py-1 text-label-muted caption-strong cursor-default">
                        ${t(
                          i.type === 'dir'
                            ? 'Directories'
                            : i.type === 'lang'
                            ? 'Languages'
                            : 'Files',
                        )}
                      </div>`
                      : ''
                  }<div class="suggestion-item cursor-pointer flex items-center justify-start rounded-6 gap-2 px-2 h-8 body-s text-label-title max-w-[600px] ellipsis">${
                    i.type === 'dir'
                      ? `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M2 5.5C2 4.39543 2.89543 3.5 4 3.5H7.17157C7.70201 3.5 8.21071 3.71071 8.58579 4.08579L9.41421 4.91421C9.78929 5.28929 10.298 5.5 10.8284 5.5H16C17.1046 5.5 18 6.39543 18 7.5V14.5C18 15.6046 17.1046 16.5 16 16.5H4C2.89543 16.5 2 15.6046 2 14.5V5.5Z" fill="currentColor"></path></svg>`
                      : `<span class="${
                          icons.getClassWithColor(
                            getFileExtensionForLang(i.display, true),
                          ) || icons.getClassWithColor('.txt')
                        } text-left w-4 h-4 file-icon flex items-center flex-shrink-0"></span>`
                  }<span class="ellipsis">${i.display}</span></div></div>`,
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
