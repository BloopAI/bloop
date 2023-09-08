import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { conversationsCache } from '../services/cache';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
} from '../types/general';
import { getConversation } from '../services/api';
import { mapLoadingSteps } from '../mappers/conversation';
import { ChatContext } from '../context/chatContext';

const useConversation = (threadId: string, recordId: number) => {
  const { t } = useTranslation();
  const { conversation } = useContext(ChatContext.Values);
  const { setThreadId, setConversation } = useContext(ChatContext.Setters);
  const [data, setData] = useState(
    conversationsCache[threadId]?.[recordId] || conversation[recordId],
  );

  useEffect(() => {
    if (!threadId || (!recordId && recordId !== 0)) {
      setData(null);
    }
    const d =
      conversationsCache[threadId]?.[recordId] || conversation[recordId];
    if (d?.results) {
      setData(d);
    }
  }, [
    (conversation[recordId] as ChatMessageServer)?.results,
    (conversation[recordId] as ChatMessageServer)?.isLoading,
    recordId,
    threadId,
  ]);

  useEffect(() => {
    if (
      threadId &&
      recordId > -1 &&
      !conversationsCache[threadId]?.[recordId] &&
      !conversation[recordId]
    ) {
      getConversation(threadId).then((resp) => {
        const conv: ChatMessage[] = [];
        resp.forEach((m) => {
          // @ts-ignore
          const userQuery = m.search_steps.find((s) => s.type === 'QUERY');
          conv.push({
            author: ChatMessageAuthor.User,
            text: m.query?.target?.Plain || userQuery?.content?.query || '',
            isFromHistory: true,
          });
          conv.push({
            author: ChatMessageAuthor.Server,
            isLoading: false,
            loadingSteps: mapLoadingSteps(m.search_steps, t),
            text: m.conclusion,
            results: m.answer,
            isFromHistory: true,
            queryId: m.id,
            responseTimestamp: m.response_timestamp,
          });
        });
        conversationsCache[threadId] = conv;
        setThreadId(threadId);
        setConversation(conv);
      });
    }
  }, []);

  return { data };
};

export default useConversation;
