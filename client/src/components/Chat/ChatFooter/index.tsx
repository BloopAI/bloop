import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { useTranslation } from 'react-i18next';
import { OnChangeHandlerFunc } from 'react-mentions';
import {
  ChatMessageAuthor,
  ChatMessageServer,
  OpenChatHistoryItem,
} from '../../../types/general';
import { ChatContext } from '../../../context/chatContext';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import NLInput from './NLInput';

type Props = {
  inputValue: string;
  valueToEdit: Record<string, any> | null;
  setInputValue: Dispatch<SetStateAction<string>>;
  onMessageEditCancel: () => void;
  setHistoryOpen: (b: boolean) => void;
  isLoading: boolean;
  isHistoryOpen: boolean;
  queryIdToEdit?: string;
  hideMessagesFrom: number | null;
  stopGenerating: () => void;
  openHistoryItem: OpenChatHistoryItem | null;
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
  valueToEdit,
}: Props) => {
  const { t } = useTranslation();
  const { conversation, selectedLines, submittedQuery } = useContext(
    ChatContext.Values,
  );
  const { setSelectedLines, setSubmittedQuery, setConversation, setThreadId } =
    useContext(ChatContext.Setters);

  const onSubmit = useCallback(
    (value: string) => {
      if (
        (conversation[conversation.length - 1] as ChatMessageServer)
          ?.isLoading ||
        !value.trim()
      ) {
        return;
      }
      if (hideMessagesFrom !== null) {
        setConversation((prev) => prev.slice(0, hideMessagesFrom));
      }
      blurInput();
      setSubmittedQuery(
        submittedQuery === value ? `${value} ` : value, // to trigger new search if query hasn't changed
      );
    },
    [conversation, submittedQuery, hideMessagesFrom],
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

  const handleInputChange = useCallback<OnChangeHandlerFunc>((e) => {
    setInputValue(e.target.value);
  }, []);

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
    <div className="flex flex-col gap-3 w-full absolute bottom-0 left-0 p-4 bg-chat-bg-base/25 backdrop-blur-6 border-t border-chat-bg-border z-20">
      <form className="w-full" onClick={onFormClick}>
        <NLInput
          id="question-input"
          value={inputValue}
          onSubmit={onSubmit}
          onChange={handleInputChange}
          isStoppable={isLoading}
          setInputValue={setInputValue}
          valueToEdit={valueToEdit}
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
          submittedQuery={submittedQuery}
        />
      </form>
    </div>
  );
};

export default memo(ChatFooter);
