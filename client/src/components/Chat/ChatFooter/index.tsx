import React, {
  ChangeEvent,
  Dispatch,
  FormEvent,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  ChatMessageAuthor,
  ChatMessageServer,
  OpenChatHistoryItem,
} from '../../../types/general';
import { ChatContext } from '../../../context/chatContext';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import { getTutorialQuestions } from '../../../services/api';
import OverflowTracker from '../../OverflowTracker';
import { TutorialQuestionType } from '../../../types/api';
import {
  getJsonFromStorage,
  HIDE_TUTORIALS_KEY,
  saveJsonToStorage,
} from '../../../services/storage';
import NLInput from './NLInput';

type Props = {
  inputValue: string;
  setInputValue: Dispatch<SetStateAction<string>>;
  onMessageEditCancel: () => void;
  setHistoryOpen: (b: boolean) => void;
  isLoading: boolean;
  isHistoryOpen: boolean;
  queryIdToEdit?: string;
  hideMessagesFrom: number | null;
  stopGenerating: () => void;
  openHistoryItem: OpenChatHistoryItem | null;
  repoRef: string;
};

const blurInput = () => {
  findElementInCurrentTab('#question-input')?.blur();
};

const ChatFooter = ({
  inputValue,
  setInputValue,
  onMessageEditCancel,
  isLoading,
  queryIdToEdit,
  hideMessagesFrom,
  stopGenerating,
  openHistoryItem,
  isHistoryOpen,
  setHistoryOpen,
  repoRef,
}: Props) => {
  const { t } = useTranslation();
  const { conversation, selectedLines, submittedQuery } = useContext(
    ChatContext.Values,
  );
  const { setSelectedLines, setSubmittedQuery, setConversation, setThreadId } =
    useContext(ChatContext.Setters);
  const [tutorials, setTutorials] = useState<TutorialQuestionType[]>([]);
  const [tutorialsHidden, setTutorialsHidden] = useState(
    getJsonFromStorage<string[]>(HIDE_TUTORIALS_KEY)?.includes(repoRef),
  );

  useEffect(() => {
    getTutorialQuestions(repoRef).then((resp) => setTutorials(resp.questions));
  }, []);

  const onHideTutorials = useCallback(() => {
    setTutorialsHidden(true);
    const prev = getJsonFromStorage<string[]>(HIDE_TUTORIALS_KEY);
    saveJsonToStorage(
      HIDE_TUTORIALS_KEY,
      prev ? [...prev, repoRef] : [repoRef],
    );
  }, [repoRef]);

  const onSubmit = useCallback(
    (e?: FormEvent) => {
      if (e?.preventDefault) {
        e.preventDefault();
      }
      if (
        (conversation[conversation.length - 1] as ChatMessageServer)
          ?.isLoading ||
        !inputValue.trim()
      ) {
        return;
      }
      if (hideMessagesFrom !== null) {
        setConversation((prev) => prev.slice(0, hideMessagesFrom));
      }
      blurInput();
      setSubmittedQuery(
        submittedQuery === inputValue ? `${inputValue} ` : inputValue, // to trigger new search if query hasn't changed
      );
    },
    [inputValue, conversation, submittedQuery, hideMessagesFrom],
  );

  const loadingSteps = useMemo(() => {
    return conversation[conversation.length - 1]?.author ===
      ChatMessageAuthor.Server
      ? [
          ...(conversation[conversation.length - 1] as ChatMessageServer)
            .loadingSteps,
          ...((conversation[conversation.length - 1] as ChatMessageServer)?.text
            ?.length
            ? [
                {
                  displayText: t('Responding...'),
                  content: { query: '' },
                  path: '',
                  type: 'code' as const,
                },
              ]
            : []),
        ]
      : undefined;
  }, [JSON.stringify(conversation[conversation.length - 1])]);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value),
    [],
  );

  const onFormClick = useCallback(() => {
    if (isHistoryOpen) {
      if (openHistoryItem) {
        setThreadId(openHistoryItem.threadId);
        setConversation(openHistoryItem.conversation);
      }
      setHistoryOpen(false);
    }
  }, [isHistoryOpen, openHistoryItem, setHistoryOpen]);

  return (
    <div className="flex flex-col gap-3 w-full absolute bottom-0 left-0 p-4 bg-chat-bg-base/25 backdrop-blur-6 border-t border-chat-bg-border">
      {!isHistoryOpen && !!tutorials.length && !tutorialsHidden && (
        <div className="w-full overflow-auto">
          <OverflowTracker className="auto-fade-horizontal">
            <div className="flex items-center gap-1">
              {tutorials.map((t, i) => (
                <button
                  key={i}
                  className="px-3 py-1 rounded-full border border-chat-bg-divider bg-chat-bg-shade flex-shrink-0 caption text-label-base"
                  onClick={() => setInputValue(t.question)}
                >
                  {t.tag}
                </button>
              ))}
              <button
                key="hide"
                className="pl-3 pr-2.5 py-1 flex items-center gap-1 rounded-full border border-chat-bg-divider bg-chat-bg-shade flex-shrink-0 caption text-label-muted"
                onClick={onHideTutorials}
              >
                <Trans>Hide</Trans>
                {/*<CloseSign raw sizeClassName="w-2 h-2" />*/}
              </button>
            </div>
          </OverflowTracker>
        </div>
      )}
      <form onSubmit={onSubmit} className="w-full" onClick={onFormClick}>
        <NLInput
          id="question-input"
          value={inputValue}
          onSubmit={onSubmit}
          onChange={handleInputChange}
          isStoppable={isLoading}
          loadingSteps={loadingSteps}
          generationInProgress={
            (conversation[conversation.length - 1] as ChatMessageServer)
              ?.isLoading
          }
          onStop={stopGenerating}
          selectedLines={selectedLines}
          setSelectedLines={setSelectedLines}
          queryIdToEdit={queryIdToEdit}
          onMessageEditCancel={onMessageEditCancel}
        />
      </form>
    </div>
  );
};

export default memo(ChatFooter);
