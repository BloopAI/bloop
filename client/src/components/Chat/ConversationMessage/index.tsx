import React, { useContext, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Trans, useTranslation } from 'react-i18next';
import {
  Checkmark,
  List,
  MagnifyTool,
  Paper,
  PointClick,
  QuillIcon,
  Sparkles,
  WrenchAndScrewdriver,
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
import MarkdownWithCode from '../../MarkdownWithCode';
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
  const { t } = useTranslation();
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
              <span>{s.type === 'PROC' ? t('Reading ') : s.displayText}</span>
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
            <p>{isLoading ? t('Generating response...') : t('Answer Ready')}</p>
            <Button
              size="tiny"
              variant={isLoadingStepsShown ? 'tertiary-active' : 'tertiary'}
              onlyIcon
              title={t(`${isLoadingStepsShown ? 'Hide' : 'Show'} search steps`)}
              onClick={() => setLoadingStepsShown((prev) => !prev)}
            >
              <List />
            </Button>
          </div>
          {!isLoading && !!results?.Filesystem?.length ? (
            <div className="flex items-center justify-end justify-self-end">
              <button
                className="text-bg-main body-s mr-2"
                onClick={() => {
                  navigateConversationResults(i, threadId);
                }}
              >
                <Trans>View</Trans>
              </button>
            </div>
          ) : null}
        </div>
      )}
      {message ? (
        <>
          <div
            className={`relative bg-chat-bg-shade mt-3 flex items-start p-4 gap-3 border border-chat-bg-divider rounded-lg`}
          >
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-chat-bg-border overflow-hidden flex items-center justify-center select-none">
                {author === ChatMessageAuthor.User ? (
                  <img
                    src={envConfig.github_user?.avatar_url}
                    alt={t('avatar')}
                  />
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
            {message && (
              <pre className="body-s text-label-title whitespace-pre-wrap break-word markdown">
                {author === ChatMessageAuthor.Server ? (
                  <ReactMarkdown>{message}</ReactMarkdown>
                ) : (
                  message
                )}
              </pre>
            )}
          </div>
          {!isLoading && !!results?.Article ? (
            <div className="mt-3 select-none cursor-default group-summary">
              {results.Article.split('\n\n')
                .slice(0, 3)
                .reverse()
                .map((p, index, array) =>
                  index === 2 || array.length === 1 ? (
                    <div
                      key={index}
                      className="p-4 flex items-start gap-3 rounded-md border border-chat-bg-border bg-chat-bg-base shadow-low h-30 overflow-hidden relative z-30"
                    >
                      <div className="py-1.5 px-2 rounded bg-chat-bg-border overflow-hidden select-none flex-shrink-0">
                        <div className="w-3 h-4">
                          <Paper raw />
                        </div>
                      </div>
                      <p className="body-s text-label-title overflow-hidden max-h-full pointer-events-none summary-card">
                        <MarkdownWithCode
                          openFileModal={() => {}}
                          repoName={''}
                          markdown={p}
                        />
                      </p>
                      <button
                        className="absolute top-0 bottom-0 left-0 right-0 opacity-0 bg-chat-bg-base/75 hover:opacity-100 hover:backdrop-blur-sm"
                        onClick={() => {
                          navigateArticleResponse(i, threadId);
                        }}
                      >
                        <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 body-s-strong text-label-link">
                          Open results
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div
                      key={index}
                      className={`px-2 py-1.5 rounded-md border pointer-events-none border-chat-bg-border 
                      bg-chat-bg-base h-30 overflow-hidden caption relative ${
                        index === 0 || array.length === 2
                          ? 'z-0 mx-6 -mb-28 group-summary-hover:-mb-[6.5rem]'
                          : 'z-10 mx-3 -mb-28 group-summary-hover:-mb-24'
                      } transition-all duration-200 summary-card`}
                    >
                      <MarkdownWithCode
                        openFileModal={() => {}}
                        repoName={''}
                        markdown={p}
                      />
                    </div>
                  ),
                )}
            </div>
          ) : null}
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
      ) : error ? (
        <div className="flex items-start gap-3 text-bg-danger p-4 mt-3 rounded-lg bg-[linear-gradient(90deg,rgba(251,113,133,0.08)_0%,rgba(231,139,152,0.08)_33.18%,rgba(191,191,191,0.08)_100%)]">
          <WrenchAndScrewdriver />
          <div className="flex flex-col gap-1">
            <p className="body-s text-label-title">
              <Trans>Something went wrong</Trans>
            </p>
            <p className="body-s text-label-base">{error}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ConversationMessage;
