import React, {
  Fragment,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageType,
} from '../../types/general';
import { Checkmark, MagnifyTool } from '../../icons';
import { AppNavigationContext } from '../../context/appNavigationContext';
import Message from './ConversationMessage';

type Props = {
  conversation: ChatMessage[];
  searchId: string;
  isLoading?: boolean;
};

const Conversation = ({ conversation, searchId, isLoading }: Props) => {
  const messagesRef = useRef<HTMLDivElement>(null);
  const { navigateConversationResults } = useContext(AppNavigationContext);
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current?.scrollTo({
        left: 0,
        top: messagesRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [conversation]);

  return (
    <div
      className="w-full flex flex-col gap-3 pb-3 overflow-auto max-h-80"
      ref={messagesRef}
    >
      {conversation.map((m, i) => (
        <Fragment key={i}>
          {m.author === ChatMessageAuthor.Server &&
            m.type === ChatMessageType.Answer &&
            m.text && (
              <div className="flex gap-2 px-4 items-center">
                {!m.isLoading ? (
                  <div className="text-success-500 h-5">
                    <Checkmark />
                  </div>
                ) : (
                  <div className="text-gray-400 h-5">
                    <MagnifyTool />
                  </div>
                )}
                <p className="caption text-gray-400 flex-1">
                  {m.isLoading
                    ? m.loadingSteps[m.loadingSteps.length - 1]
                    : 'Answer Ready'}
                </p>
                {!m.isLoading && !!m.results?.length ? (
                  <div className="flex items-center justify-end justify-self-end">
                    <button
                      className="text-primary-300 body-s mr-2"
                      onClick={() => navigateConversationResults(i)}
                    >
                      View
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          {m.text || (m.author === ChatMessageAuthor.Server && m.error) ? (
            <Message
              isHistory={false}
              author={m.author}
              message={
                m.text ||
                (m.author === ChatMessageAuthor.Server && m.error) ||
                ''
              }
              showInlineFeedback={
                m.author === ChatMessageAuthor.Server &&
                !m.isLoading &&
                !isLoading &&
                i === conversation.length - 1
              }
              searchId={searchId}
              query={conversation[0].text || ''}
            />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
};

export default Conversation;
