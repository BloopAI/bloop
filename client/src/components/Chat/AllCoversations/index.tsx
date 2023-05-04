import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import ChipButton from '../ChipButton';
import { ArrowLeft, CloseSign } from '../../../icons';
import NLInput from '../NLInput';
import {
  deleteConversation,
  getAllConversations,
  getConversation,
} from '../../../services/api';
import { AllConversationsResponse, ConversationType } from '../../../types/api';
import Conversation from '../Conversation';
import ConversationListItem from './ConversationListItem';

type Props = {
  isHistoryOpen: boolean;
  setHistoryOpen: (b: boolean) => void;
  setActive: (b: boolean) => void;
};

const AllConversations = ({
  isHistoryOpen,
  setHistoryOpen,
  setActive,
}: Props) => {
  const [openItem, setOpenItem] = useState<ConversationType | null>(null);
  const [conversations, setConversations] = useState<AllConversationsResponse>(
    [],
  );

  const fetchConversations = useCallback(() => {
    getAllConversations().then(setConversations);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, []);

  const onDelete = useCallback((threadId: string) => {
    deleteConversation(threadId).then(fetchConversations);
  }, []);

  const onClick = useCallback((threadId: string) => {
    getConversation(threadId).then(setOpenItem);
  }, []);

  return (
    <div
      className={`w-97 flex-shrink-0 border-l border-gray-800 h-full flex flex-col overflow-hidden ${
        isHistoryOpen ? 'mr-0' : '-mr-97'
      } transition-all duration-300 ease-out-slow`}
    >
      <div className="p-4 bg-gray-900/75 border-b border-gray-800 backdrop-blur-6 flex items-center gap-2 text-gray-200">
        {!!openItem && (
          <ChipButton variant="filled" onClick={() => setOpenItem(null)}>
            <ArrowLeft sizeClassName="w-4 h-4" />
          </ChipButton>
        )}
        <p className="flex-1 body-m">
          {openItem ? 'Where are the ctags?' : 'Conversations'}
        </p>
        {!openItem && (
          <ChipButton
            onClick={() => {
              setHistoryOpen(false);
              setActive(true);
            }}
          >
            Create new
          </ChipButton>
        )}
        <ChipButton variant="filled" onClick={() => setHistoryOpen(false)}>
          <CloseSign sizeClassName="w-3.5 h-3.5" />
        </ChipButton>
      </div>
      {!openItem && (
        <div className="flex flex-col gap-1 py-4 overflow-auto flex-1 pb-12">
          {conversations.map((c) => (
            <ConversationListItem
              key={c.thread_id}
              title={c.title}
              subtitle={format(
                new Date(c.created_at * 1000),
                'EEEE, MMMM d, h:m a',
              )}
              onClick={() => onClick(c.thread_id)}
              onDelete={() => onDelete(c.thread_id)}
            />
          ))}
        </div>
      )}
      {!!openItem && (
        <div className="min-h-[2rem]">
          <Conversation
            conversation={openItem}
            searchId={''}
            isLoading={false}
          />
        </div>
      )}
      <div className="backdrop-blur-6 bg-gray-900/75 -mt-10">
        <div
          className="p-4"
          onClick={() => {
            document.getElementById('question-input')?.focus();
            setActive(true);
            setHistoryOpen(false);
          }}
        >
          <NLInput />
        </div>
      </div>
    </div>
  );
};

export default AllConversations;
