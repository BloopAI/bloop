import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
} from 'react';
import { Trans } from 'react-i18next';
import { Info } from '../../../icons';
import { ChatMessage, OpenChatHistoryItem } from '../../../types/general';
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
  tabName: string;
  hideMessagesFrom: null | number;
  openHistoryItem: OpenChatHistoryItem | null;
  setOpenHistoryItem: Dispatch<SetStateAction<OpenChatHistoryItem | null>>;
};

const ChatBody = ({
  isHistoryTab,
  isLoading,
  onMessageEdit,
  queryIdToEdit,
  repoRef,
  repoName,
  tabName,
  hideMessagesFrom,
  openHistoryItem,
  setOpenHistoryItem,
}: Props) => {
  const { conversation, threadId } = useContext(ChatContext.Values);
  return (
    <div
      className={`${
        isHistoryTab ? '' : 'p-4'
      } overflow-auto flex-1 relative flex flex-col`}
    >
      {isHistoryTab ? (
        <AllConversations
          repoRef={repoRef}
          repoName={repoName}
          openItem={openHistoryItem}
          setOpenItem={setOpenHistoryItem}
        />
      ) : !conversation.length ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="flex flex-col items-center max-w-[18rem] text-center transform -translate-y-1/2">
            <img
              src="/bloopHeadMascot.png"
              alt="mascot"
              className="w-16 h-16 mb-5"
            />
            <p className="body-m-strong text-label-title mb-1">
              Hi, I am bloop!
            </p>
            <p className="body-s text-label-base">
              I am here to answer any of your questions related to {tabName}.
            </p>
          </div>
        </div>
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
