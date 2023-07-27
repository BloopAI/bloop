import { useContext, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { conversationsCache } from '../../services/cache';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
} from '../../types/general';
import { ChatContext } from '../../context/chatContext';
import { FileModalContext } from '../../context/fileModalContext';
import { UIContext } from '../../context/uiContext';
import { getConversation } from '../../services/api';
import { mapLoadingSteps } from '../../mappers/conversation';
import MarkdownWithCode from '../../components/MarkdownWithCode';

type Props = {
  recordId: number;
  threadId: string;
};

const ArticleResponse = ({ recordId, threadId }: Props) => {
  const { t } = useTranslation();
  const { conversation, setThreadId, setConversation } =
    useContext(ChatContext);
  const { openFileModal } = useContext(FileModalContext);
  const { tab } = useContext(UIContext);
  const data = useMemo(
    () => conversationsCache[threadId]?.[recordId] || conversation[recordId],
    [
      (conversation[recordId] as ChatMessageServer)?.results,
      (conversation[recordId] as ChatMessageServer)?.isLoading,
      recordId,
      threadId,
    ],
  );

  useEffect(() => {
    if (!conversationsCache[threadId]?.[recordId] && !conversation[recordId]) {
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
            loadingSteps: mapLoadingSteps(m.search_steps, t),
            text: m.conclusion,
            results: m.outcome,
            isFromHistory: true,
            queryId: m.id,
          });
        });
        conversationsCache[threadId] = conv;
        setThreadId(threadId);
        setConversation(conv);
      });
    }
  }, []);

  return (
    <div className="overflow-auto p-8 w-screen">
      <div className="flex-1 mx-auto max-w-3xl box-content article-response body-m text-label-base pb-44 break-word">
        <MarkdownWithCode
          openFileModal={openFileModal}
          repoName={tab.repoName}
          markdown={
            data?.isLoading
              ? data?.results?.Article?.replace(
                  /\[\`[^`]*$|\[\`[^`]+\`\]\([^)]*$/,
                  '',
                )
              : data?.results?.Article
          }
        />
      </div>
    </div>
  );
};

export default ArticleResponse;
