import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import throttle from 'lodash.throttle';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/ResultsPageHeader';
import { ChatContext } from '../../context/chatContext';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
  FileSystemResult,
  MessageResultCite,
  MessageResultDirectory,
} from '../../types/general';
import { UIContext } from '../../context/uiContext';
import { ChevronDown } from '../../icons';
import { conversationsCache } from '../../services/cache';
import { repositionAnnotationsOnScroll } from '../../utils/scrollUtils';
import { getConversation } from '../../services/api';
import { mapLoadingSteps } from '../../mappers/conversation';
import NewCode from './NewCode';
import DiffCode from './DiffCode';
import CodeAnnotation, { Comment } from './CodeAnotation';
import DirectoryAnnotation from './DirectoryAnnotation';

type Props = {
  recordId: number;
  threadId: string;
};

const ConversationResult = ({ recordId, threadId }: Props) => {
  const { t } = useTranslation();
  const { conversation, setConversation, setThreadId } =
    useContext(ChatContext);
  const { tab } = useContext(UIContext);
  const [isScrolled, setScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setScrolled(false);
  }, [recordId]);

  const data = useMemo(
    () =>
      (
        (
          (conversationsCache[threadId]?.[recordId] ||
            conversation[recordId]) as ChatMessageServer
        )?.results as FileSystemResult
      )?.Filesystem || [],
    [
      (conversation[recordId] as ChatMessageServer)?.results,
      recordId,
      threadId,
    ],
  );

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
            responseTimestamp: m.response_timestamp,
          });
        });
        conversationsCache[threadId] = conv;
        setThreadId(threadId);
        setConversation(conv);
      });
    }
  }, []);

  useEffect(() => {
    setScrolled(false);
  }, [recordId]);

  const citations = useMemo(() => {
    const files: Record<string, Comment[]> = {};
    data
      .filter((d): d is MessageResultCite => 'Cite' in d)
      .forEach((c, i) => {
        if (c.Cite.path && files[c.Cite.path]) {
          files[c.Cite.path].push({ ...c.Cite, i });
        } else if (c.Cite.path) {
          files[c.Cite.path] = [{ ...c.Cite, i }];
        }
      });
    Object.keys(files).forEach((k) => {
      files[k] = files[k].sort((a, b) =>
        !a.start_line || !b.start_line
          ? 0
          : a.start_line < b.start_line
          ? -1
          : 1,
      );
    });
    return files;
  }, [data]);
  const dirCitations = useMemo(() => {
    const files: Record<string, any> = {};
    data
      .filter((d): d is MessageResultDirectory => 'Directory' in d)
      .forEach((c, i) => {
        if (c.Directory.path && files[c.Directory.path]) {
          files[c.Directory.path].push({ ...c.Directory, i });
        } else if (c.Directory.path) {
          files[c.Directory.path] = [{ ...c.Directory, i }];
        }
      });
    return files;
  }, [data]);
  const otherBlocks = useMemo(
    () => data.filter((d) => !('Cite' in d || 'Directory' in d)),
    [data],
  );

  const handleScroll = useMemo(
    () =>
      throttle(
        (e: React.UIEvent<HTMLDivElement>) => {
          setScrolled(true);
          const scrollTop = (e.target as HTMLDivElement).scrollTop;
          repositionAnnotationsOnScroll(
            scrollTop,
            Object.keys(citations).length ? citations : dirCitations,
          );
        },
        75,
        { trailing: true, leading: true },
      ),
    [citations, dirCitations],
  );

  return (
    <div
      className="overflow-auto w-screen"
      ref={containerRef}
      onScroll={handleScroll}
      id="results-page-container"
    >
      <div className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content">
        {containerRef.current &&
          containerRef.current.scrollHeight -
            containerRef.current.clientHeight >
            180 &&
          !isScrolled && (
            <div className="fixed z-30 left-1/2 bottom-24 transform -translate-x-1/2">
              <div
                className={`rounded-full bg-bg-main text-label-control shadow-low caption 
                flex gap-1 items-center justify-center pl-4 pr-3 py-2 select-none`}
              >
                More results <ChevronDown />
              </div>
            </div>
          )}
        <PageHeader
          resultsNumber={data?.length}
          showCollapseControls={false}
          loading={false}
        />
        <div className="flex flex-col gap-4 pb-44">
          <CodeAnnotation repoName={tab.repoName} citations={citations} />
          <DirectoryAnnotation
            repoName={tab.repoName}
            citations={dirCitations}
          />
          {otherBlocks.map((b, i) => {
            if ('New' in b && b.New.code && b.New.language) {
              return (
                <NewCode code={b.New.code} language={b.New.language} key={i} />
              );
            } else if ('Modify' in b && b.Modify.diff) {
              return (
                <DiffCode data={b.Modify} key={i} repoName={tab.repoName} />
              );
            }
          })}
        </div>
      </div>
    </div>
  );
};

export default ConversationResult;
