import React, { useCallback, useEffect, useRef } from 'react';
import { ChatMessage, ChatMessageAuthor } from '../../types/general';
import Message from './ConversationMessage';

type Props = {
  conversation: ChatMessage[];
  searchId: string;
  isLoading?: boolean;
  isHistory?: boolean;
};

const Conversation = ({
  conversation,
  searchId,
  isLoading,
  isHistory,
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
          searchId={searchId}
          query={conversation[0].text || ''}
          scrollToBottom={scrollToBottom}
        />
      ))}
    </div>
  );
};

export default Conversation;
