import { memo, useContext, useMemo } from 'react';
import { Trans } from 'react-i18next';
import ScrollToBottom from 'react-scroll-to-bottom';
import { ChatMessageAuthor, ChatMessageServer } from '../../../types/general';
import { ProjectContext } from '../../../context/projectContext';
import { WarningSignIcon } from '../../../icons';
import { ChatContext, ChatsContext } from '../../../context/chatsContext';
import StarterMessage from './StarterMessage';
import Input from './Input';
import Message from './Message';

type Props = {
  side: 'left' | 'right';
  tabKey: string;
};

const Conversation = ({ side, tabKey }: Props) => {
  const { project } = useContext(ProjectContext.Current);
  const { chats } = useContext(ChatsContext);

  const chatData: ChatContext | undefined = useMemo(
    () => chats[tabKey],
    [chats, tabKey],
  );

  return !chatData ? null : (
    <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 overflow-auto">
      <ScrollToBottom className="max-w-full flex flex-col overflow-auto">
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
            projectId={project?.id!}
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
                : (chatData.conversation[i - 1] as ChatMessageServer)
                    ?.queryId || '00000000-0000-0000-0000-000000000000'
            }
            onMessageEdit={chatData.onMessageEdit}
            responseTimestamp={
              m.author === ChatMessageAuthor.Server ? m.responseTimestamp : null
            }
            singleFileExplanation={
              m.author === ChatMessageAuthor.Server &&
              !!m.explainedFile &&
              // m.explainedFile === navigatedItem?.path
              false
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
      </ScrollToBottom>
      <Input
        selectedLines={chatData.selectedLines}
        setSelectedLines={chatData.setSelectedLines}
        onStop={chatData.stopGenerating}
        submittedQuery={chatData.submittedQuery}
        isStoppable={chatData.isLoading}
        onMessageEditCancel={chatData.onMessageEditCancel}
        generationInProgress={
          (
            chatData.conversation[
              chatData.conversation.length - 1
            ] as ChatMessageServer
          )?.isLoading
        }
        hideMessagesFrom={chatData.hideMessagesFrom}
        queryIdToEdit={chatData.queryIdToEdit}
        valueToEdit={chatData.inputImperativeValue}
        setInputValue={chatData.setInputValue}
        value={chatData.inputValue}
        setConversation={chatData.setConversation}
        conversation={chatData.conversation}
        setSubmittedQuery={chatData.setSubmittedQuery}
      />
    </div>
  );
};

export default memo(Conversation);
