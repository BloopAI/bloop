import React, { Dispatch, memo, SetStateAction, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Info } from '../../../icons';
import { OpenChatHistoryItem } from '../../../types/general';
import { ChatContext } from '../../../context/chatContext';
import AllConversations from './AllCoversations';
import Conversation from './Conversation';

type Props = {
  isHistoryTab: boolean;
  isLoading: boolean;
  onMessageEdit: (queryId: string, i: number) => void;
  queryIdToEdit: string;
  repoRef: string;
  repoName: string;
  hideMessagesFrom: null | number;
  openHistoryItem: OpenChatHistoryItem | null;
  setOpenHistoryItem: Dispatch<SetStateAction<OpenChatHistoryItem | null>>;
  setInputValue: Dispatch<SetStateAction<string>>;
};

const ChatBody = ({
  isHistoryTab,
  isLoading,
  onMessageEdit,
  queryIdToEdit,
  repoRef,
  repoName,
  hideMessagesFrom,
  openHistoryItem,
  setOpenHistoryItem,
  setInputValue,
}: Props) => {
  useTranslation();
  const { conversation, threadId } = useContext(ChatContext.Values);
  return (
    <div className={`overflow-auto flex-1 relative flex flex-col`}>
      {isHistoryTab ? (
        <AllConversations
          repoRef={repoRef}
          repoName={repoName}
          openItem={openHistoryItem}
          setOpenItem={setOpenHistoryItem}
        />
      ) : (
        <Conversation
          conversation={
            hideMessagesFrom === null
              ? conversation
              : conversation.slice(0, hideMessagesFrom + 1)
          }
          threadId={threadId}
          repoRef={repoRef}
          isLoading={isLoading}
          repoName={repoName}
          onMessageEdit={onMessageEdit}
          setInputValue={setInputValue}
        />
      )}
      {!!queryIdToEdit && (
        <div className="mx-4 mb-3 flex gap-1.5 caption text-label-base select-none">
          <Info raw sizeClassName="w-3.5 h-3.5" />
          <p>
            <Trans>
              Editing a previously submitted question will discard all answers
              and questions following it.
            </Trans>
          </p>
        </div>
      )}
    </div>
  );
};

export default memo(ChatBody);
