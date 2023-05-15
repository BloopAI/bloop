import React, { Fragment, useContext, useEffect, useRef } from 'react';
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
  isHistory?: boolean;
  setHistoryOpen: (b: boolean) => void;
};

const Conversation = ({
  conversation,
  searchId,
  isLoading,
  isHistory,
  setHistoryOpen,
}: Props) => {
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
      className={`w-full flex flex-col gap-3 pb-3 overflow-auto ${
        !isHistory ? 'max-h-80' : ''
      }`}
      ref={messagesRef}
    >
      {conversation.map((m, i) => (
        <Fragment key={i}>
          {m.author === ChatMessageAuthor.Server &&
            m.type === ChatMessageType.Answer &&
            m.text && (
              <div className="flex gap-2 px-4 items-center">
                {!m.isLoading ? (
                  <div className="text-bg-success-hover h-5">
                    <Checkmark />
                  </div>
                ) : (
                  <div className="text-label-base h-5">
                    <MagnifyTool />
                  </div>
                )}
                <p className="caption text-label-base flex-1">
                  {m.isLoading
                    ? m.loadingSteps[m.loadingSteps.length - 1]
                    : 'Answer Ready'}
                </p>
                {!m.isLoading && !!m.results?.length ? (
                  <div className="flex items-center justify-end justify-self-end">
                    <button
                      className="text-bg-main body-s mr-2"
                      onClick={() => {
                        navigateConversationResults(i, searchId);
                        setHistoryOpen(false);
                      }}
                    >
                      View
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          {m.text || (m.author === ChatMessageAuthor.Server && m.error) ? (
            <Message
              isHistory={isHistory}
              author={m.author}
              message={m.text}
              error={m.author === ChatMessageAuthor.Server ? m.error : ''}
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
