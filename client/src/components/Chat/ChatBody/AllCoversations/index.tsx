import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  deleteConversation,
  getAllConversations,
  getConversation,
} from '../../../../services/api';
import { AllConversationsResponse } from '../../../../types/api';
import Conversation from '../Conversation';
import {
  ChatMessage,
  ChatMessageAuthor,
  OpenChatHistoryItem,
} from '../../../../types/general';
import { conversationsCache } from '../../../../services/cache';
import {
  mapLoadingSteps,
  mapUserQuery,
} from '../../../../mappers/conversation';
import { LocaleContext } from '../../../../context/localeContext';
import { getDateFnsLocale } from '../../../../utils';
import ConversationListItem from './ConversationListItem';

type Props = {
  repoRef: string;
  repoName: string;
  openItem: OpenChatHistoryItem | null;
  setOpenItem: Dispatch<SetStateAction<OpenChatHistoryItem | null>>;
};

const AllConversations = ({
  repoRef,
  repoName,
  openItem,
  setOpenItem,
}: Props) => {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<AllConversationsResponse>(
    [],
  );
  const { locale } = useContext(LocaleContext);

  const fetchConversations = useCallback(() => {
    getAllConversations(repoRef).then(setConversations);
  }, [repoRef]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const onDelete = useCallback((threadId: string) => {
    deleteConversation(threadId).then(fetchConversations);
  }, []);

  const onClick = useCallback((threadId: string) => {
    getConversation(threadId).then((resp) => {
      const conv: ChatMessage[] = [];
      resp.forEach((m) => {
        // @ts-ignore
        const userQuery = m.search_steps.find((s) => s.type === 'QUERY');
        const parsedQuery = mapUserQuery(m);
        conv.push({
          author: ChatMessageAuthor.User,
          text: m.query.raw_query || userQuery?.content?.query || '',
          parsedQuery,
          isFromHistory: true,
        });
        conv.push({
          author: ChatMessageAuthor.Server,
          isLoading: false,
          loadingSteps: mapLoadingSteps(m.search_steps, t),
          text: m.answer,
          conclusion: m.conclusion,
          isFromHistory: true,
          queryId: m.id,
          responseTimestamp: m.response_timestamp,
          explainedFile: m.focused_chunk?.file_path,
        });
      });
      setOpenItem({ conversation: conv, threadId });
      conversationsCache[threadId] = conv;
    });
  }, []);

  return (
    <div className={`flex-1 flex flex-col overflow-auto`}>
      {!openItem && (
        <div className="flex flex-col gap-1 overflow-auto flex-1 pb-28">
          {conversations.map((c) => (
            <ConversationListItem
              key={c.thread_id}
              title={c.title}
              subtitle={format(
                new Date(c.created_at * 1000),
                'EEEE, MMMM d, HH:mm',
                getDateFnsLocale(locale),
              )}
              onClick={() => onClick(c.thread_id)}
              onDelete={() => onDelete(c.thread_id)}
            />
          ))}
        </div>
      )}
      {!!openItem && (
        <div className="flex-1 overflow-auto">
          <Conversation
            conversation={openItem.conversation}
            threadId={openItem.threadId}
            repoRef={repoRef}
            isLoading={false}
            isHistory
            repoName={repoName}
            onMessageEdit={() => {}}
            setInputValueImperatively={() => {}}
          />
        </div>
      )}
    </div>
  );
};

export default AllConversations;
