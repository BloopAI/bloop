import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { EditorState, TextSelection, Transaction } from 'prosemirror-state';
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
import { InputEditorContent, ParsedQueryType } from '../../../../types/general';
import { getFileExtensionForLang } from '../../../../utils';
import { blurInput } from '../../../../utils/domUtils';
import { MentionOptionType } from '../../../../types/results';
import { getMentionsPlugin } from './mentionPlugin';
import { addMentionNodes, mapEditorContentToInputValue } from './utils';
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
  getDataLang: (search: string) => Promise<MentionOptionType[]>;
  getDataPath: (search: string) => Promise<MentionOptionType[]>;
  getDataRepo: (search: string) => Promise<MentionOptionType[]>;
  initialValue?: Record<string, any> | null;
  onChange: (contents: InputEditorContent[]) => void;
  onSubmit?: (s: { parsed: ParsedQueryType[]; plain: string }) => void;
  placeholder: string;
};

const InputCore = ({
  getDataLang,
  getDataPath,
  getDataRepo,
  initialValue,
  onChange,
  onSubmit,
  placeholder,
}: Props) => {
  const { t } = useTranslation();
  const mentionPlugin = useMemo(
    () =>
      getMentionsPlugin({
        delay: 10,
        getSuggestions: async (
          type: string,
          text: string,
          done: (s: MentionOptionType[]) => void,
        ) => {
          const data = await Promise.all([
            getDataRepo(text),
            getDataPath(text),
            getDataLang(text),
          ]);
          done([...data[0], ...data[1], ...data[2]]);
        },
        getSuggestionsHTML: (items) => {
          return (
            '<div class="suggestion-item-list rounded-md border border-bg-border p-1 shadow-high max-h-[40vh] overflow-auto bg-bg-shade">' +
            items
              .map(
                (i) =>
                  `<div>${
                    i.isFirst
                      ? `<div class="flex items-center gap-2 px-2 py-1 text-label-muted caption-strong cursor-default">
                        ${t(
                          i.type === 'repo'
                            ? 'Repositories'
                            : i.type === 'dir'
                            ? 'Directories'
                            : i.type === 'lang'
                            ? 'Languages'
                            : 'Files',
                        )}
                      </div>`
                      : ''
                  }<div class="suggestion-item cursor-pointer flex items-center justify-between rounded-6 gap-2 px-2 h-8 body-s text-label-title max-w-[600px] ellipsis"><span class="flex items-center gap-2">${
                    i.type === 'repo'
                      ? `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"> <path fill-rule="evenodd" clip-rule="evenodd" d="M4.6665 1.33301C3.56193 1.33301 2.6665 2.22844 2.6665 3.33301V12.6663C2.6665 13.7709 3.56193 14.6663 4.6665 14.6663H12.6665C13.0347 14.6663 13.3332 14.3679 13.3332 13.9997V1.99967C13.3332 1.63148 13.0347 1.33301 12.6665 1.33301H4.6665ZM4.6665 11.9997H11.9998V13.333H4.6665C4.29831 13.333 3.99984 13.0345 3.99984 12.6663C3.99984 12.2982 4.29831 11.9997 4.6665 11.9997Z" fill="currentColor" /></svg>`
                      : i.type === 'dir'
                      ? `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M2 5.5C2 4.39543 2.89543 3.5 4 3.5H7.17157C7.70201 3.5 8.21071 3.71071 8.58579 4.08579L9.41421 4.91421C9.78929 5.28929 10.298 5.5 10.8284 5.5H16C17.1046 5.5 18 6.39543 18 7.5V14.5C18 15.6046 17.1046 16.5 16 16.5H4C2.89543 16.5 2 15.6046 2 14.5V5.5Z" fill="currentColor"></path></svg>`
                      : `<span class="${
                          icons.getClassWithColor(
                            getFileExtensionForLang(i.display, true),
                          ) || icons.getClassWithColor('.txt')
                        } text-left w-4 h-4 file-icon flex items-center flex-shrink-0"></span>`
                  }<span class="ellipsis text-left">${i.display}</span></span>${
                    i.hint
                      ? `<span class="ellipsis text-label-muted text-left body-mini">${i.hint}</span>`
                      : ''
                  }</div></div>`,
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
      placeholderPlugin(placeholder),
      react(),
      mentionPlugin,
      keymap({
        ...baseKeymap,
        Escape: (state) => {
          const key = Object.keys(state).find((k) =>
            k.startsWith('autosuggestions'),
          );

          // @ts-ignore
          if (key && state[key]?.active) {
            return true;
          }
          blurInput();
          return true;
        },
        Enter: (state) => {
          const key = Object.keys(state).find((k) =>
            k.startsWith('autosuggestions'),
          );
          // @ts-ignore
          if (key && state[key]?.active) {
            return false;
          }
          const parts = state.toJSON().doc?.content?.[0]?.content;
          // trying to submit with no text
          if (!parts) {
            return false;
          }
          onSubmit?.(mapEditorContentToInputValue(parts));
          return true;
        },
        'Ctrl-Enter': baseKeymap.Enter,
        'Cmd-Enter': baseKeymap.Enter,
        'Shift-Enter': baseKeymap.Enter,
      }),
    ];
  }, [onSubmit]);

  const { nodeViews, renderNodeViews } = useNodeViews(reactNodeViews);
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  const [state, setState] = useState(
    EditorState.create({
      doc: initialValue
        ? schema.topNodeType.create(null, [schema.nodeFromJSON(initialValue)])
        : undefined,
      schema,
      plugins,
    }),
  );

  useEffect(() => {
    if (mount) {
      const newState = EditorState.create({
        schema,
        plugins,
        doc: initialValue
          ? schema.topNodeType.create(null, [schema.nodeFromJSON(initialValue)])
          : undefined,
      });
      const endPos = newState.selection.$to.after() - 1;
      newState.selection = new TextSelection(newState.doc.resolve(endPos));
      setState(newState);
    }
  }, [mount, initialValue, plugins]);

  const dispatchTransaction = useCallback(
    (tr: Transaction) => setState((oldState) => oldState.apply(tr)),
    [],
  );

  useEffect(() => {
    const newValue = state.toJSON().doc?.content?.[0]?.content || '';
    onChange(newValue || []);
  }, [state]);

  return (
    <div className="w-full body-base pb-4 !leading-[24px] overflow-auto bg-transparent outline-none focus:outline-0 resize-none flex-grow-0 flex flex-col justify-center">
      <ProseMirror
        mount={mount}
        state={state}
        nodeViews={nodeViews}
        dispatchTransaction={dispatchTransaction}
      >
        <div ref={setMount} autoCorrect="off" />
        {renderNodeViews()}
      </ProseMirror>
    </div>
  );
};

export default memo(InputCore);
