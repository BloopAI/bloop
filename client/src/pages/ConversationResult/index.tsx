import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import throttle from 'lodash.throttle';
import PageHeader from '../../components/ResultsPageHeader';
import { ChatContext } from '../../context/chatContext';
import {
  ChatMessageServer,
  MessageResultCite,
  MessageResultDirectory,
} from '../../types/general';
import { UIContext } from '../../context/uiContext';
import { ChevronDown } from '../../icons';
import { conversationsCache } from '../../services/cache';
import { repositionAnnotationsOnScroll } from '../../utils/scrollUtils';
import NewCode from './NewCode';
import DiffCode from './DiffCode';
import CodeAnnotation, { Comment } from './CodeAnotation';
import DirectoryAnnotation from './DirectoryAnnotation';

type Props = {
  recordId: number;
  threadId: string;
};

const ConversationResult = ({ recordId, threadId }: Props) => {
  const { conversation } = useContext(ChatContext);
  const { tab } = useContext(UIContext);
  const [isScrolled, setScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setScrolled(false);
  }, [recordId]);

  const data = useMemo(
    () =>
      (
        (conversationsCache[threadId]?.[recordId] ||
          conversation[recordId]) as ChatMessageServer
      )?.results || [],
    [
      (conversation[recordId] as ChatMessageServer)?.results,
      recordId,
      threadId,
    ],
  );
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
      className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content"
      ref={containerRef}
      onScroll={handleScroll}
      id="results-page-container"
    >
      {containerRef.current &&
        containerRef.current.scrollHeight - containerRef.current.clientHeight >
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
        <DirectoryAnnotation repoName={tab.repoName} citations={dirCitations} />
        {otherBlocks.map((b, i) => {
          if ('New' in b && b.New.code && b.New.language) {
            return (
              <NewCode code={b.New.code} language={b.New.language} key={i} />
            );
          } else if ('Modify' in b && b.Modify.diff) {
            return <DiffCode data={b.Modify} key={i} repoName={tab.repoName} />;
          }
        })}
      </div>
    </div>
  );
};

export default ConversationResult;
