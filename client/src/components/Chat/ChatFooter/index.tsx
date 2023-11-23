import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChatMessageAuthor,
  ChatMessageServer,
  OpenChatHistoryItem,
  ParsedQueryType,
} from '../../../types/general';
import { ChatContext } from '../../../context/chatContext';
import NLInput from './NLInput';

type Props = {
  inputValue: { parsed: ParsedQueryType[]; plain: string };
  valueToEdit: Record<string, any> | null;
  setInputValue: Dispatch<
    SetStateAction<{ parsed: ParsedQueryType[]; plain: string }>
  >;
  onMessageEditCancel: () => void;
  setHistoryOpen: (b: boolean) => void;
  isLoading: boolean;
  isHistoryOpen: boolean;
  queryIdToEdit?: string;
  hideMessagesFrom: number | null;
  stopGenerating: () => void;
  openHistoryItem: OpenChatHistoryItem | null;
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
    <div className="flex flex-col gap-3 w-full absolute bottom-0 left-0 p-4 bg-chat-bg-base/25 backdrop-blur-6 border-t border-chat-bg-border z-20 ml-px">
      <form className="w-full" onClick={onFormClick}>
        <NLInput
          value={inputValue}
          onSubmit={onSubmit}
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
        />
      </form>
    </div>
  );
};

export default memo(ChatFooter);
