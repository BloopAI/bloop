import { useContext, useEffect, useMemo, useState } from 'react';
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
import Button from '../../components/Button';
import { CopyMD } from '../../icons';
import { copyToClipboard } from '../../utils';

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
  const [data, setData] = useState(
    conversationsCache[threadId]?.[recordId] || conversation[recordId],
  );

  useEffect(() => {
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
    if (!conversationsCache[threadId]?.[recordId] && !conversation[recordId]) {
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
      <div className="flex-1 mx-auto max-w-3xl box-content article-response body-m text-label-base pb-44 break-word relative">
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
        <Button
          variant="secondary"
          size="small"
          onClick={() => copyToClipboard(data?.results?.Article)}
          className="absolute top-0 right-0"
        >
          <CopyMD /> Copy
        </Button>
      </div>
    </div>
  );
};

export default ArticleResponse;
