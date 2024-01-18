import {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { EnvContext } from '../../../../context/envContext';
import {
  ChatMessage,
  ChatMessageServer,
  FileTabType,
  InputEditorContent,
  ParsedQueryType,
  TabTypesEnum,
} from '../../../../types/general';
import { getAutocomplete } from '../../../../services/api';
import { FileResItem, LangItem, RepoItem } from '../../../../types/api';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import KeyboardHint from '../../../../components/KeyboardHint';
import { focusInput } from '../../../../utils/domUtils';
import { MentionOptionType } from '../../../../types/results';
import { splitPath } from '../../../../utils';
import { openTabsCache } from '../../../../services/cache';
import InputCore from './InputCore';
import { mapEditorContentToInputValue } from './utils';

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
  isInputAtBottom?: boolean;
  projectId: string;
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
  isInputAtBottom,
  projectId,
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasRendered(true);
    setTimeout(focusInput, 500);
  }, []);

  useEffect(() => {
    if (hasRendered) {
      setInitialValue(valueToEdit);
    }
  }, [valueToEdit]);

  // useEffect(() => {
  //   if (containerRef.current) {
  //     setIsInputAtBottom(containerRef.current)
  //   }
  // }, [conversation]);

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
    setInputValue(mapEditorContentToInputValue(inputState));
  }, []);

  const onSubmitButtonClicked = useCallback(() => {
    if (value && onSubmit) {
      onSubmit(value);
    }
  }, [value, onSubmit]);

  const getDataPath = useCallback(
    async (search: string) => {
      const respPath = await getAutocomplete(
        projectId,
        `path:${search}&content=false`,
      );
      const fileResults = respPath.data.filter(
        (d): d is FileResItem => d.kind === 'file_result',
      );
      const dirResults = fileResults
        .filter((d) => d.data.is_dir)
        .map((d) => ({
          path: d.data.relative_path.text,
          repo: d.data.repo_ref,
        }));
      const filesResults = openTabsCache.tabs
        .filter(
          (t): t is FileTabType =>
            t.type === TabTypesEnum.FILE &&
            (!search || t.path.toLowerCase().includes(search.toLowerCase())),
        )
        .map((t) => ({ path: t.path, repo: t.repoRef }));
      filesResults.push(
        ...fileResults
          .filter(
            (d) =>
              !d.data.is_dir &&
              !filesResults.find(
                (f) =>
                  f.path === d.data.relative_path.text &&
                  f.repo === d.data.repo_ref,
              ),
          )
          .map((d) => ({
            path: d.data.relative_path.text,
            repo: d.data.repo_ref,
          })),
      );
      const results: MentionOptionType[] = [];
      filesResults.forEach((fr, i) => {
        results.push({
          id: fr.path,
          display: fr.path,
          type: 'file',
          isFirst: i === 0,
          hint: splitPath(fr.repo).pop(),
        });
      });
      dirResults.forEach((fr, i) => {
        results.push({
          id: fr.path,
          display: fr.path,
          type: 'dir',
          isFirst: i === 0,
          hint: splitPath(fr.repo).pop(),
        });
      });
      return results;
    },
    [projectId],
  );

  const getDataLang = useCallback(
    async (
      search: string,
      // callback: (a: { id: string; display: string }[]) => void,
    ) => {
      const respLang = await getAutocomplete(
        projectId,
        `lang:${search}&content=false`,
      );
      const langResults = respLang.data
        .filter((d): d is LangItem => d.kind === 'lang')
        .map((d) => d.data);
      const results: MentionOptionType[] = [];
      langResults.forEach((fr, i) => {
        results.push({ id: fr, display: fr, type: 'lang', isFirst: i === 0 });
      });
      return results;
    },
    [projectId],
  );

  const getDataRepo = useCallback(
    async (
      search: string,
      // callback: (a: { id: string; display: string }[]) => void,
    ) => {
      const respRepo = await getAutocomplete(
        projectId,
        `repo:${search}&content=false&path=false&file=false`,
      );
      const repoResults = respRepo.data
        .filter((d): d is RepoItem => d.kind === 'repository_result')
        .map((d) => d.data);
      const results: MentionOptionType[] = [];
      repoResults.forEach((rr, i) => {
        results.push({
          id: rr.name.text,
          display: rr.name.text.replace('github.com/', ''),
          type: 'repo',
          isFirst: i === 0,
        });
      });
      return results;
    },
    [projectId],
  );

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        ((onMessageEditCancel && queryIdToEdit) || (isStoppable && onStop))
      ) {
        e.preventDefault();
        e.stopPropagation();
        onMessageEditCancel?.();
        onStop?.();
      }
    },
    [onMessageEditCancel, isStoppable, onStop],
  );
  useKeyboardNavigation(handleKeyEvent, !queryIdToEdit && !isStoppable);

  return (
    <div
      className={`flex items-start w-full p-4 gap-4 rounded-tl-md rounded-tr-md ${
        isInputAtBottom
          ? 'bg-bg-base border-t border-x border-bg-border shadow-medium'
          : ''
      }`}
      ref={containerRef}
    >
      <div className="w-7 h-7 rounded-full overflow-hidden select-none">
        <img src={envConfig.github_user?.avatar_url} alt={t('avatar')} />
      </div>
      <div className="flex flex-col gap-1 flex-1 items-start">
        <p className="body-base-b text-label-title select-none">
          <Trans>You</Trans>
        </p>
        {generationInProgress ? (
          <div className="select-none text-label-muted body-base cursor-default">
            <Trans>Generating answer...</Trans>
          </div>
        ) : (
          <InputCore
            getDataLang={getDataLang}
            getDataPath={getDataPath}
            getDataRepo={getDataRepo}
            initialValue={initialValue}
            onChange={onChangeInput}
            onSubmit={onSubmit}
            placeholder={t(
              'Write a message, @ to mention files, folders or docs...',
            )}
          />
        )}
        <div className="self-end flex gap-2 items-center select-none">
          {isStoppable && (
            <button
              className="flex gap-1 items-center py-1 pr-1 pl-2 rounded-6 body-mini-b text-label-base bg-bg-base disabled:text-label-muted disabled:bg-bg-base"
              onClick={onStop}
            >
              <Trans>Stop generating</Trans>
              <KeyboardHint shortcut="Esc" />
            </button>
          )}
          {!!queryIdToEdit && (
            <button
              className="flex gap-1 items-center py-1 pr-1 pl-2 rounded-6 body-mini-b text-label-base bg-bg-base disabled:text-label-muted disabled:bg-bg-base"
              onClick={onMessageEditCancel}
            >
              <Trans>Cancel</Trans>
              <KeyboardHint shortcut="Esc" />
            </button>
          )}
          <button
            className="flex gap-1 items-center py-1 pr-1 pl-2 rounded-6 body-mini-b text-label-base bg-bg-base disabled:text-label-muted disabled:bg-bg-base"
            disabled={!value?.plain || generationInProgress}
            onClick={onSubmitButtonClicked}
          >
            <Trans>Submit</Trans>
            <KeyboardHint shortcut="entr" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(ConversationInput);
