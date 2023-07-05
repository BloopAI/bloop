import React, { useContext, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Checkmark,
  List,
  MagnifyTool,
  PointClick,
  QuillIcon,
  Sparkles,
} from '../../../icons';
import { DeviceContext } from '../../../context/deviceContext';
import {
  ArticleResult,
  ChatLoadingStep,
  ChatMessageAuthor,
  FileSystemResult,
} from '../../../types/general';
import { ChatContext } from '../../../context/chatContext';
import Button from '../../Button';
import { AppNavigationContext } from '../../../context/appNavigationContext';
import { FileModalContext } from '../../../context/fileModalContext';
import MessageFeedback from './MessageFeedback';
import FileChip from './FileChip';

type Props = {
  author: ChatMessageAuthor;
  message?: string;
  error?: string;
  threadId: string;
  queryId: string;
  repoRef: string;
  isHistory?: boolean;
  showInlineFeedback: boolean;
  scrollToBottom?: () => void;
  isLoading?: boolean;
  loadingSteps?: ChatLoadingStep[];
  results?: FileSystemResult & ArticleResult;
  i: number;
};

const ConversationMessage = ({
  author,
  message,
  error,
  isHistory,
  showInlineFeedback,
  threadId,
  queryId,
  repoRef,
  scrollToBottom,
  isLoading,
  loadingSteps,
  results,
  i,
}: Props) => {
  const [isLoadingStepsShown, setLoadingStepsShown] = useState(false);
  const { envConfig } = useContext(DeviceContext);
  const { setChatOpen } = useContext(ChatContext);
  const { navigateConversationResults, navigateArticleResponse } =
    useContext(AppNavigationContext);
  const { openFileModal } = useContext(FileModalContext);

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
            maxHeight: isLoadingStepsShown ? loadingSteps.length * 36 : 0,
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
                <FileChip
                  onClick={() => openFileModal(s.content)}
                  fileName={s.content.split('/').pop() || ''}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
      {author === ChatMessageAuthor.Server && (
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
            <p>{isLoading ? 'Generating response...' : 'Answer Ready'}</p>
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
          {!isLoading &&
          (!!results?.Filesystem?.length || !!results?.Article) ? (
            <div className="flex items-center justify-end justify-self-end">
              <button
                className="text-bg-main body-s mr-2"
                onClick={() => {
                  if (results?.Article) {
                    navigateArticleResponse(i, threadId);
                  } else {
                    navigateConversationResults(i, threadId);
                  }
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
            className={`relative group-custom bg-chat-bg-shade mt-3 flex items-start p-4 gap-3 border border-chat-bg-divider rounded-lg`}
          >
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-chat-bg-border overflow-hidden flex items-center justify-center select-none">
                {author === ChatMessageAuthor.User ? (
                  <img src={envConfig.github_user?.avatar_url} alt="avatar" />
                ) : (
                  <div className="w-3 h-3">
                    <Sparkles raw />
                  </div>
                )}
              </div>
              {author === ChatMessageAuthor.User && (
                <div className="absolute -bottom-1 -right-1 w-4 h-3 bg-chat-bg-border box-content border-2 border-chat-bg-shade text-label-title rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-2">
                    <QuillIcon raw />
                  </div>
                </div>
              )}
            </div>
            <pre className="body-s text-label-title whitespace-pre-wrap break-word markdown">
              {author === ChatMessageAuthor.Server ? (
                <ReactMarkdown>{message || error || ''}</ReactMarkdown>
              ) : (
                message
              )}
            </pre>
          </div>
          <MessageFeedback
            showInlineFeedback={showInlineFeedback}
            isHistory={isHistory}
            threadId={threadId}
            queryId={queryId}
            repoRef={repoRef}
            error={!!error}
            scrollToBottom={scrollToBottom}
          />
        </>
      ) : null}
    </div>
  );
};

export default ConversationMessage;
