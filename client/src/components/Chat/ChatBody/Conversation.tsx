import React, { Dispatch, SetStateAction, useContext } from 'react';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
} from '../../../types/general';
import useScrollToBottom from '../../../hooks/useScrollToBottom';
import { AppNavigationContext } from '../../../context/appNavigationContext';
import Message from './ConversationMessage';
import FirstMessage from './FirstMessage';

type Props = {
  conversation: ChatMessage[];
  threadId: string;
  repoRef: string;
  repoName: string;
  isLoading?: boolean;
  isHistory?: boolean;
  onMessageEdit: (queryId: string, i: number) => void;
  setInputValue: Dispatch<SetStateAction<string>>;
};

const Conversation = ({
  conversation,
  threadId,
  repoRef,
  isLoading,
  isHistory,
  repoName,
  onMessageEdit,
  setInputValue,
}: Props) => {
  const { messagesRef, handleScroll, scrollToBottom } =
    useScrollToBottom(conversation);
  const { navigatedItem } = useContext(AppNavigationContext);

  return (
    <div
      className={`w-full flex flex-col gap-3 overflow-auto pb-28`}
      ref={messagesRef}
      onScroll={handleScroll}
    >
      {!isHistory && (
        <FirstMessage
          repoName={repoName}
          setInputValue={setInputValue}
          repoRef={repoRef}
          isEmptyConversation={!conversation.length}
        />
      )}
      {conversation.map((m, i) => (
        <Message
          key={i}
          i={i}
          isLoading={m.author === ChatMessageAuthor.Server && m.isLoading}
          loadingSteps={
            m.author === ChatMessageAuthor.Server ? m.loadingSteps : []
          }
          isHistory={isHistory}
          author={m.author}
          message={m.text}
          parsedQuery={
            m.author === ChatMessageAuthor.Server ? undefined : m.parsedQuery
          }
          error={m.author === ChatMessageAuthor.Server ? m.error : ''}
          showInlineFeedback={
            m.author === ChatMessageAuthor.Server &&
            !m.isLoading &&
            !isLoading &&
            i === conversation.length - 1 &&
            !m.isFromHistory
          }
          threadId={threadId}
          queryId={
            m.author === ChatMessageAuthor.Server
              ? m.queryId
              : (conversation[i - 1] as ChatMessageServer)?.queryId ||
                '00000000-0000-0000-0000-000000000000'
          }
          repoRef={repoRef}
          scrollToBottom={scrollToBottom}
          repoName={repoName}
          onMessageEdit={onMessageEdit}
          responseTimestamp={
            m.author === ChatMessageAuthor.Server ? m.responseTimestamp : null
          }
          singleFileExplanation={
            m.author === ChatMessageAuthor.Server &&
            !!m.explainedFile &&
            m.explainedFile === navigatedItem?.path
          }
        />
      ))}
    </div>
  );
};

export default Conversation;
