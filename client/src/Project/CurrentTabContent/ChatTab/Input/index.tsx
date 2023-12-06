import {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { EnvContext } from '../../../../context/envContext';
import {
  ChatLoadingStep,
  ChatMessage,
  ChatMessageServer,
  InputEditorContent,
  ParsedQueryType,
  ParsedQueryTypeEnum,
} from '../../../../types/general';
import { getAutocomplete } from '../../../../services/api';
import { FileResItem, LangItem } from '../../../../types/api';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import InputCore from './InputCore';

type Props = {
  value?: { parsed: ParsedQueryType[]; plain: string };
  valueToEdit?: Record<string, any> | null;
  generationInProgress?: boolean;
  isStoppable?: boolean;
  onStop?: () => void;
  setInputValue: Dispatch<
    SetStateAction<{ parsed: ParsedQueryType[]; plain: string }>
  >;
  selectedLines?: [number, number] | null;
  setSelectedLines?: (l: [number, number] | null) => void;
  queryIdToEdit?: string;
  onMessageEditCancel?: () => void;
  conversation: ChatMessage[];
  hideMessagesFrom: number | null;
  setConversation: Dispatch<SetStateAction<ChatMessage[]>>;
  setSubmittedQuery: Dispatch<
    SetStateAction<{ parsed: ParsedQueryType[]; plain: string }>
  >;
  submittedQuery: { parsed: ParsedQueryType[]; plain: string };
};

type SuggestionType = {
  id: string;
  display: string;
  type: 'file' | 'dir' | 'lang';
  isFirst: boolean;
};

const ConversationInput = ({
  value,
  valueToEdit,
  setInputValue,
  generationInProgress,
  isStoppable,
  onStop,
  selectedLines,
  setSelectedLines,
  queryIdToEdit,
  onMessageEditCancel,
  conversation,
  hideMessagesFrom,
  setConversation,
  setSubmittedQuery,
  submittedQuery,
}: Props) => {
  const { t } = useTranslation();
  const { envConfig } = useContext(EnvContext);
  const [initialValue, setInitialValue] = useState<
    Record<string, any> | null | undefined
  >({
    type: 'paragraph',
    content: value?.parsed
      .filter((pq) => ['path', 'lang', 'text'].includes(pq.type))
      .map((pq) =>
        pq.type === 'text'
          ? { type: 'text', text: pq.text }
          : {
              type: 'mention',
              attrs: {
                id: pq.text,
                display: pq.text,
                type: pq.type,
                isFirst: false,
              },
            },
      ),
  });
  const [hasRendered, setHasRendered] = useState(false);

  useEffect(() => {
    setHasRendered(true);
  }, []);

  useEffect(() => {
    if (hasRendered) {
      setInitialValue(valueToEdit);
    }
  }, [valueToEdit]);

  const onSubmit = useCallback(
    (value: { parsed: ParsedQueryType[]; plain: string }) => {
      if (
        (conversation[conversation.length - 1] as ChatMessageServer)
          ?.isLoading ||
        !value.plain.trim()
      ) {
        return;
      }
      if (hideMessagesFrom !== null) {
        setConversation((prev) => prev.slice(0, hideMessagesFrom));
      }
      setSubmittedQuery(value);
    },
    [conversation, submittedQuery, hideMessagesFrom],
  );

  const onChangeInput = useCallback((inputState: InputEditorContent[]) => {
    const newValue = inputState
      .map((s) =>
        s.type === 'mention' ? `${s.attrs.type}:${s.attrs.id}` : s.text,
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
    setInputValue({
      plain: newValue,
      parsed: newValueParsed,
    });
  }, []);

  const onSubmitButtonClicked = useCallback(() => {
    if (value && onSubmit) {
      onSubmit(value);
    }
  }, [value, onSubmit]);
  const getDataPath = useCallback(async (search: string) => {
    const respPath = await getAutocomplete(`path:${search}&content=false`);
    const fileResults = respPath.data.filter(
      (d): d is FileResItem => d.kind === 'file_result',
    );
    const dirResults = fileResults
      .filter((d) => d.data.is_dir)
      .map((d) => d.data.relative_path.text);
    const filesResults = fileResults
      .filter((d) => !d.data.is_dir)
      .map((d) => d.data.relative_path.text);
    const results: SuggestionType[] = [];
    filesResults.forEach((fr, i) => {
      results.push({ id: fr, display: fr, type: 'file', isFirst: i === 0 });
    });
    dirResults.forEach((fr, i) => {
      results.push({ id: fr, display: fr, type: 'dir', isFirst: i === 0 });
    });
    return results;
  }, []);

  const getDataLang = useCallback(
    async (
      search: string,
      // callback: (a: { id: string; display: string }[]) => void,
    ) => {
      const respLang = await getAutocomplete(`lang:${search}&content=false`);
      const langResults = respLang.data
        .filter((d): d is LangItem => d.kind === 'lang')
        .map((d) => d.data);
      const results: SuggestionType[] = [];
      langResults.forEach((fr, i) => {
        results.push({ id: fr, display: fr, type: 'lang', isFirst: i === 0 });
      });
      return results;
    },
    [],
  );

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onMessageEditCancel) {
        e.preventDefault();
        e.stopPropagation();
        onMessageEditCancel();
      }
    },
    [onMessageEditCancel],
  );
  useKeyboardNavigation(handleKeyEvent, !queryIdToEdit);

  return (
    <div className="flex items-start w-full p-4 gap-4 rounded-md">
      <div className="w-7 h-7 rounded-full overflow-hidden select-none">
        <img src={envConfig.github_user?.avatar_url} alt={t('avatar')} />
      </div>
      <div className="flex flex-col gap-1 flex-1 items-start">
        <p className="body-base-b text-label-title">
          <Trans>You</Trans>
        </p>
        <InputCore
          getDataLang={getDataLang}
          getDataPath={getDataPath}
          initialValue={initialValue}
          onChange={onChangeInput}
          onSubmit={onSubmit}
          placeholder={t(
            'Write a message, @ to mention files, folders or docs...',
          )}
        />
        <div className="self-end flex gap-2 items-center">
          {!!queryIdToEdit && (
            <button
              className="flex gap-1 items-center py-1 pr-1 pl-2 rounded-6 body-mini-b text-label-base bg-bg-base disabled:text-label-muted disabled:bg-bg-base"
              onClick={onMessageEditCancel}
            >
              <Trans>Cancel</Trans>
              <div className="h-5 flex items-center justify-center px-1 rounded bg-bg-base-hover body-mini text-label-base">
                Esc
              </div>
            </button>
          )}
          <button
            className="flex gap-1 items-center py-1 pr-1 pl-2 rounded-6 body-mini-b text-label-base bg-bg-base disabled:text-label-muted disabled:bg-bg-base"
            disabled={!value?.plain || generationInProgress}
            onClick={onSubmitButtonClicked}
          >
            <Trans>Submit</Trans>
            <div className="w-5 h-5 flex items-center justify-center px-1 rounded bg-bg-base-hover body-mini text-label-base">
              ↵
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(ConversationInput);
