import React, { useCallback, useEffect, useRef } from 'react';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
} from '../../types/general';
import Message from './ConversationMessage';

type Props = {
  conversation: ChatMessage[];
  threadId: string;
  repoRef: string;
  repoName: string;
  isLoading?: boolean;
  isHistory?: boolean;
  onMessageEdit: (parentQueryId: string, i: number) => void;
};

const Conversation = ({
  conversation,
  threadId,
  repoRef,
  isLoading,
  isHistory,
  repoName,
  onMessageEdit,
}: Props) => {
  const messagesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current?.scrollTo({
        left: 0,
        top: messagesRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversation, scrollToBottom]);

  const handleMessageEdit = useCallback(
    (i: number) => {
      if ('queryId' in conversation[i - 1]) {
        onMessageEdit((conversation[i - 1] as ChatMessageServer).queryId, i);
      }
    },
    [conversation, onMessageEdit],
  );

  return (
    <div
      className={`w-full flex flex-col gap-3 pb-3 overflow-auto ${
        !isHistory ? 'max-h-80' : ''
      }`}
      ref={messagesRef}
    >
      {conversation.map((m, i) => (
        <Message
          key={i}
          i={i}
          isLoading={m.author === ChatMessageAuthor.Server && m.isLoading}
          loadingSteps={
            m.author === ChatMessageAuthor.Server ? m.loadingSteps : []
          }
          results={
            m.author === ChatMessageAuthor.Server ? m.results : undefined
          }
          isHistory={isHistory}
          author={m.author}
          message={m.text}
          error={m.author === ChatMessageAuthor.Server ? m.error : ''}
          showInlineFeedback={
            m.author === ChatMessageAuthor.Server &&
            !m.isLoading &&
            !isLoading &&
            i === conversation.length - 1 &&
            !m.isFromHistory
          }
          threadId={threadId}
          queryId={m.author === ChatMessageAuthor.Server ? m.queryId : ''}
          repoRef={repoRef}
          scrollToBottom={scrollToBottom}
          repoName={repoName}
          onMessageEdit={handleMessageEdit}
          responseTimestamp={
            m.author === ChatMessageAuthor.Server ? m.responseTimestamp : null
          }
        />
      ))}
    </div>
  );
};

export default Conversation;
