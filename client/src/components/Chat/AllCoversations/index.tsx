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
import { AllConversationsResponse } from '../../../types/api';
import Conversation from '../Conversation';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageType,
} from '../../../types/general';
import { conversationsCache } from '../../../services/cache';
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
  const [openItem, setOpenItem] = useState<ChatMessage[] | null>(null);
  const [conversations, setConversations] = useState<AllConversationsResponse>(
    [],
  );
  const [threadId, setThreadId] = useState('');

  const fetchConversations = useCallback(() => {
    getAllConversations().then(setConversations);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [isHistoryOpen]);

  const onDelete = useCallback((threadId: string) => {
    deleteConversation(threadId).then(fetchConversations);
  }, []);

  const onClick = useCallback((threadId: string) => {
    setThreadId(threadId);
    getConversation(threadId).then((resp) => {
      conversationsCache[threadId] = resp;
      const conv = resp.map((m) => {
        return {
          author: ChatMessageAuthor.Server,
          isLoading: false,
          type: ChatMessageType.Answer,
          loadingSteps: m.search_steps?.map(
            (s: { type: string; content: string }) => s.content,
          ),
          text: m.conclusion,
          results: m.results,
        };
      });
      setOpenItem(conv);
    });
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
        <div className="flex-1 px-4 py-2">
          <Conversation
            conversation={openItem}
            searchId={threadId}
            isLoading={false}
            isHistory
            setHistoryOpen={setHistoryOpen}
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
