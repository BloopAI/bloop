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
import { mapLoadingSteps } from '../../../mappers/conversation';
import ConversationListItem from './ConversationListItem';

type Props = {
  isHistoryOpen: boolean;
  setHistoryOpen: (b: boolean) => void;
  setActive: (b: boolean) => void;
  setConversation: (b: ChatMessage[]) => void;
  setThreadId: (b: string) => void;
  repoRef: string;
  handleNewConversation: () => void;
};

const AllConversations = ({
  isHistoryOpen,
  setHistoryOpen,
  setActive,
  setThreadId,
  setConversation,
  repoRef,
  handleNewConversation,
}: Props) => {
  const [openItem, setOpenItem] = useState<ChatMessage[] | null>(null);
  const [conversations, setConversations] = useState<AllConversationsResponse>(
    [],
  );
  const [openThreadId, setOpenThreadId] = useState('');
  const [title, setTitle] = useState('');

  const fetchConversations = useCallback(() => {
    getAllConversations(repoRef).then(setConversations);
  }, [repoRef]);

  useEffect(() => {
    if (isHistoryOpen) {
      fetchConversations();
    }
  }, [isHistoryOpen, fetchConversations]);

  const onDelete = useCallback((threadId: string) => {
    deleteConversation(threadId).then(fetchConversations);
  }, []);

  const onClick = useCallback((threadId: string) => {
    setOpenThreadId(threadId);
    getConversation(threadId).then((resp) => {
      const conv: ChatMessage[] = [];
      resp.forEach((m) => {
        const userQuery = m.search_steps.find((s) => s.type === 'QUERY');
        if (userQuery) {
          conv.push({
            author: ChatMessageAuthor.User,
            text: userQuery.content,
            isFromHistory: true,
          });
        }
        conv.push({
          author: ChatMessageAuthor.Server,
          isLoading: false,
          type: ChatMessageType.Answer,
          loadingSteps: mapLoadingSteps(m.search_steps),
          text: m.conclusion,
          results: m.results,
          isFromHistory: true,
        });
      });
      setTitle(conv[0].text || '');
      setOpenItem(conv);
      conversationsCache[threadId] = conv;
    });
  }, []);

  return (
    <div
      className={`w-97 flex-shrink-0 bg-chat-bg-sub border-l border-chat-bg-divider h-full flex flex-col overflow-hidden ${
        isHistoryOpen ? 'mr-0' : '-mr-97'
      } transition-all duration-300 ease-out-slow`}
    >
      <div className="p-4 bg-chat-bg-base/35 border-b border-chat-bg-border flex items-center gap-2 text-label-title">
        {!!openItem && (
          <ChipButton variant="filled" onClick={() => setOpenItem(null)}>
            <ArrowLeft sizeClassName="w-4 h-4" />
          </ChipButton>
        )}
        <p className="flex-1 body-m">{openItem ? title : 'Conversations'}</p>
        {!openItem && (
          <ChipButton
            onClick={() => {
              setHistoryOpen(false);
              setActive(true);
              handleNewConversation();
            }}
          >
            Create new
          </ChipButton>
        )}
        <ChipButton
          variant="filled"
          colorScheme="base"
          onClick={() => setHistoryOpen(false)}
        >
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
        <div className="flex-1 px-4 py-2 overflow-auto pb-10">
          <Conversation
            conversation={openItem}
            searchId={openThreadId}
            isLoading={false}
            isHistory
          />
        </div>
      )}
      <div className="backdrop-blur-6 bg-chat-bg-base/75 -mt-10">
        <div
          className="p-4"
          onClick={() => {
            if (openItem) {
              setThreadId(openThreadId);
              setConversation(openItem);
            }
            setHistoryOpen(false);
            setActive(true);
            document.getElementById('question-input')?.focus();
          }}
        >
          <NLInput />
        </div>
      </div>
    </div>
  );
};

export default AllConversations;
