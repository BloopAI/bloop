import React, { useContext, useEffect, useState } from 'react';
import {
  Checkmark,
  List,
  MagnifyTool,
  PointClick,
  QuillIcon,
} from '../../../icons';
import { DeviceContext } from '../../../context/deviceContext';
import { ChatLoadingStep, ChatMessageAuthor } from '../../../types/general';
import { ChatContext } from '../../../context/chatContext';
import Button from '../../Button';
import { AppNavigationContext } from '../../../context/appNavigationContext';
import MessageFeedback from './MessageFeedback';

type Props = {
  author: ChatMessageAuthor;
  message?: string;
  error?: string;
  query: string;
  searchId: string;
  isHistory?: boolean;
  showInlineFeedback: boolean;
  scrollToBottom?: () => void;
  isLoading?: boolean;
  loadingSteps?: ChatLoadingStep[];
  results?: any[];
  i: number;
};

const ConversationMessage = ({
  author,
  message,
  error,
  isHistory,
  showInlineFeedback,
  query,
  searchId,
  scrollToBottom,
  isLoading,
  loadingSteps,
  results,
  i,
}: Props) => {
  const [isLoadingStepsShown, setLoadingStepsShown] = useState(false);
  const { envConfig } = useContext(DeviceContext);
  const { setChatOpen } = useContext(ChatContext);
  const { navigateConversationResults } = useContext(AppNavigationContext);

  useEffect(() => {
    setChatOpen(true);
  }, []);

  return (
    <div className="flex flex-col">
      {author === ChatMessageAuthor.Server && !!loadingSteps?.length && (
        <div
          className={`${
            isLoadingStepsShown ? 'mb-3' : ''
          } flex flex-col gap-3 px-4 overflow-hidden transition-all duration-200 ease-linear`}
          style={{
            maxHeight: isLoadingStepsShown ? loadingSteps.length * 32 : 0,
          }}
        >
          {loadingSteps.map((s, i) => (
            <div
              className="flex gap-2 caption text-label-base items-center"
              key={i}
            >
              {s.type === 'PROC' ? <PointClick /> : <MagnifyTool />}
              <span>{s.type === 'PROC' ? 'Reading ' : s.displayText}</span>
              {s.type === 'PROC' ? (
                <p>
                  {s.content.length > 40
                    ? `...${s.content.slice(-40)}`
                    : s.content}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {author === ChatMessageAuthor.Server && message && (
        <div className="flex gap-2 px-4 items-center">
          {!isLoading ? (
            <div className="text-bg-success-hover h-5">
              <Checkmark />
            </div>
          ) : (
            <div className="text-label-base h-5">
              <MagnifyTool />
            </div>
          )}
          <div className="caption text-label-base flex-1 flex gap-2 items-center">
            <p>
              {isLoading
                ? loadingSteps?.[loadingSteps.length - 1].displayText
                : 'Answer Ready'}
            </p>
            <Button
              size="tiny"
              variant={isLoadingStepsShown ? 'tertiary-active' : 'tertiary'}
              onlyIcon
              title={`${isLoadingStepsShown ? 'Hide' : 'Show'} search steps`}
              onClick={() => setLoadingStepsShown((prev) => !prev)}
            >
              <List />
            </Button>
          </div>
          {!isLoading && !!results?.length ? (
            <div className="flex items-center justify-end justify-self-end">
              <button
                className="text-bg-main body-s mr-2"
                onClick={() => {
                  navigateConversationResults(i, searchId);
                }}
              >
                View
              </button>
            </div>
          ) : null}
        </div>
      )}
      {message || (author === ChatMessageAuthor.Server && error) ? (
        <>
          <div
            className={`relative group-custom bg-chat-bg-shade mt-3 flex items-center p-4 gap-3 border border-chat-bg-divider rounded-lg`}
          >
            {author === ChatMessageAuthor.User && (
              <div className="relative">
                <div className="w-6 h-6 rounded-full bg-chat-bg-sub overflow-hidden">
                  <img src={envConfig.github_user?.avatar_url} alt="avatar" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-3 bg-chat-bg-border box-content border-2 border-chat-bg-shade text-label-title rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-2">
                    <QuillIcon raw />
                  </div>
                </div>
              </div>
            )}
            <pre className="body-s text-label-title whitespace-pre-wrap">
              {message || error}
            </pre>
          </div>
          <MessageFeedback
            showInlineFeedback={showInlineFeedback}
            isHistory={isHistory}
            query={query}
            searchId={searchId}
            message={message}
            error={!!error}
            scrollToBottom={scrollToBottom}
          />
        </>
      ) : null}
    </div>
  );
};

export default ConversationMessage;
