import React, { useContext } from 'react';
import { Trans } from 'react-i18next';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
} from '../../../types/general';
import useScrollToBottom from '../../../hooks/useScrollToBottom';
import { AppNavigationContext } from '../../../context/appNavigationContext';
import Message from './ConversationMessage';

type Props = {
  conversation: ChatMessage[];
  threadId: string;
  repoRef: string;
  repoName: string;
  isLoading?: boolean;
  isHistory?: boolean;
  onMessageEdit: (queryId: string, i: number) => void;
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
  const { messagesRef, handleScroll, scrollToBottom } =
    useScrollToBottom(conversation);
  const { navigatedItem } = useContext(AppNavigationContext);

  return (
    <div
      className={`w-full flex flex-col gap-3 overflow-auto ${
        isHistory ? 'pb-24' : 'pb-36'
      }`}
      ref={messagesRef}
      onScroll={handleScroll}
    >
      {!isHistory && (
        <div className="flex items-start gap-3 px-4 py-3 hover:bg-chat-bg-shade">
          <div className="w-6 h-6 rounded-full bg-chat-bg-border flex-shrink-0 flex items-center justify-center mt-0.5">
            <img
              src="/bloopHeadMascot.png"
              alt="mascot"
              className="w-4.5 h-4.5"
            />
          </div>
          <p className="body-s text-label-title">
            <Trans>Hi, I am bloop!</Trans>{' '}
            <Trans
              values={{ repoName: repoName.replace(/^github\.com\//, '') }}
            >
              I can answer your questions about{' '}
              <span className="font-bold">#repo</span>.
            </Trans>
          </p>
        </div>
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
