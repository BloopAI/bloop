import { Fragment, memo, useContext, useEffect } from 'react';
import { Trans } from 'react-i18next';
import { ChatMessageAuthor, ChatMessageServer } from '../../../types/general';
import { WarningSignIcon } from '../../../icons';
import { ChatContext } from '../../../context/chatsContext';
import FunctionContext from '../../../components/ScrollToBottom/FunctionContext';
import StarterMessage from './StarterMessage';
import Message from './Message';

type Props = {
  chatData: ChatContext;
  side: 'left' | 'right';
  projectId: string;
};

const ScrollableContent = ({ chatData, side, projectId }: Props) => {
  const { scrollToBottom } = useContext(FunctionContext);

  useEffect(() => {
    if (chatData.submittedQuery.plain) {
      scrollToBottom({ behavior: 'smooth' });
    }
  }, [chatData.submittedQuery]);

  return (
    <Fragment>
      <StarterMessage
        isEmptyConversation
        setInputValueImperatively={chatData.setInputValueImperatively}
      />
      {(chatData.hideMessagesFrom === null
        ? chatData.conversation
        : chatData.conversation.slice(0, chatData.hideMessagesFrom + 1)
      ).map((m, i) => (
        <Message
          key={i}
          i={i}
          side={side}
          projectId={projectId}
          isLoading={m.author === ChatMessageAuthor.Server && m.isLoading}
          loadingSteps={
            m.author === ChatMessageAuthor.Server ? m.loadingSteps : []
          }
          author={m.author}
          text={m.text || ''}
          parsedQuery={
            m.author === ChatMessageAuthor.Server ? undefined : m.parsedQuery
          }
          error={m.author === ChatMessageAuthor.Server ? m.error : ''}
          showInlineFeedback={
            m.author === ChatMessageAuthor.Server &&
            !m.isLoading &&
            !chatData.isLoading &&
            i === chatData.conversation.length - 1 &&
            !m.isFromHistory
          }
          threadId={chatData.threadId}
          queryId={
            m.author === ChatMessageAuthor.Server
              ? m.queryId
              : (chatData.conversation[i - 1] as ChatMessageServer)?.queryId ||
                '00000000-0000-0000-0000-000000000000'
          }
          onMessageEdit={chatData.onMessageEdit}
          responseTimestamp={
            m.author === ChatMessageAuthor.Server ? m.responseTimestamp : null
          }
          singleFileExplanation={
            m.author === ChatMessageAuthor.Server && !!m.explainedFile
          }
        />
      ))}
      {chatData.hideMessagesFrom !== null && (
        <div className="flex items-center w-full p-4 gap-4 select-none">
          <div className="w-7 h-7 flex items-center justify-center rounded-full bg-yellow-subtle text-yellow">
            <WarningSignIcon sizeClassName="w-3.5 h-3.5" />
          </div>
          <p className="text-yellow body-s">
            <Trans>
              Editing previously submitted questions will discard all answers
              and questions following it
            </Trans>
          </p>
        </div>
      )}
    </Fragment>
  );
};

export default memo(ScrollableContent);
