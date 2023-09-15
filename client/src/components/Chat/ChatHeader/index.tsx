import React, { Dispatch, memo, SetStateAction, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ArrowLeft, List } from '../../../icons';
import AddStudioContext from '../../AddStudioContext';
import { ChatContext } from '../../../context/chatContext';
import { OpenChatHistoryItem } from '../../../types/general';
import ChipButton from '../ChipButton';
import AnswerSpeedSelector from './AnswerSpeedSelector';

type Props = {
  isHistoryTab: boolean;
  setIsHistoryTab: (b: boolean) => void;
  handleNewConversation: () => void;
  isLoading: boolean;
  conversationName?: string;
  openHistoryItem: OpenChatHistoryItem | null;
  setOpenHistoryItem: Dispatch<SetStateAction<OpenChatHistoryItem | null>>;
};

const ChatHeader = ({
  isHistoryTab,
  setIsHistoryTab,
  handleNewConversation,
  isLoading,
  conversationName,
  openHistoryItem,
  setOpenHistoryItem,
}: Props) => {
  const { t } = useTranslation();
  const { threadId } = useContext(ChatContext.Values);
  return (
    <div className="w-full px-4 h-12 flex justify-between gap-1 items-center border-b border-chat-bg-border">
      {isHistoryTab ? (
        <ChipButton
          variant="filled"
          onClick={() =>
            openHistoryItem ? setOpenHistoryItem(null) : setIsHistoryTab(false)
          }
        >
          <ArrowLeft sizeClassName="w-4 h-4" />
        </ChipButton>
      ) : (
        <ChipButton onClick={() => setIsHistoryTab(true)}>
          <List /> <Trans>All conversations</Trans>
        </ChipButton>
      )}
      {isHistoryTab && (
        <p className="flex-1 body-m ellipsis">
          {openHistoryItem
            ? openHistoryItem.conversation?.[0].text
            : t('Conversations')}
        </p>
      )}
      <div className="flex items-center gap-1">
        <AnswerSpeedSelector />
        <ChipButton onClick={handleNewConversation}>
          <Trans>Create new</Trans>
        </ChipButton>
        {!!threadId && !isLoading && (
          <AddStudioContext
            threadId={threadId}
            name={conversationName || 'New Studio'}
          />
        )}
      </div>
    </div>
  );
};

export default memo(ChatHeader);
