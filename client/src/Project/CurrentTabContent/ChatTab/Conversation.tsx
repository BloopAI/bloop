import React, {
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChatMessageServer } from '../../../types/general';
import { ProjectContext } from '../../../context/projectContext';
import { ChatContext, ChatsContext } from '../../../context/chatsContext';
import ScrollToBottom from '../../../components/ScrollToBottom';
import Input from './Input';
import ScrollableContent from './ScrollableContent';
import DeprecatedClientModal from './DeprecatedClientModal';

type Props = {
  side: 'left' | 'right';
  tabKey: string;
};

const Conversation = ({ side, tabKey }: Props) => {
  const { project } = useContext(ProjectContext.Current);
  const { chats } = useContext(ChatsContext);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  const chatData: ChatContext | undefined = useMemo(
    () => chats[tabKey],
    [chats, tabKey],
  );

  useEffect(() => {
    setTimeout(() => {
      if (scrollableRef.current) {
        setIsScrollable(
          scrollableRef.current.scrollHeight >
            scrollableRef.current.clientHeight,
        );
      }
    }, 100);
  }, [chatData?.conversation, chatData?.hideMessagesFrom]);

  return !chatData ? null : (
    <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 overflow-auto">
      <ScrollToBottom
        className="max-w-full flex flex-col overflow-auto"
        wrapperRef={scrollableRef}
      >
        <ScrollableContent
          chatData={chatData}
          side={side}
          projectId={project?.id!}
        />
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
        isInputAtBottom={isScrollable}
      />
      <DeprecatedClientModal
        isOpen={chatData.isDeprecatedModalOpen}
        onClose={chatData.closeDeprecatedModal}
      />
    </div>
  );
};

export default memo(Conversation);
