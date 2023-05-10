import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import throttle from 'lodash.throttle';
import PageHeader from '../../components/ResultsPageHeader';
import { ChatContext } from '../../context/chatContext';
import { ChatMessageServer, MessageResultCite } from '../../types/general';
import { UIContext } from '../../context/uiContext';
import { ChevronDown } from '../../icons';
import { conversationsCache } from '../../services/cache';
import NewCode from './NewCode';
import DiffCode from './DiffCode';
import CodeAnnotation from './CodeAnotation';

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
    const files: Record<string, any> = {};
    data
      .filter((d): d is MessageResultCite => 'Cite' in d)
      .forEach((c, i) => {
        if (files[c.Cite.path]) {
          files[c.Cite.path].push({ ...c.Cite, i });
        } else {
          files[c.Cite.path || 'client/src/components/Tabs/index.tsx'] = [
            { ...c.Cite, i },
          ];
        }
      });
    return files;
  }, [data]);
  const otherBlocks = useMemo(() => data.filter((d) => !('Cite' in d)), [data]);

  const handleScroll = useMemo(
    () =>
      throttle(
        (e: React.UIEvent<HTMLDivElement>) => {
          setScrolled(true);
          const scrollTop = (e.target as HTMLDivElement).scrollTop;
          let previousCommentsHeight = 0;
          Object.values(citations).forEach((fileCite) => {
            fileCite.forEach((c: any) => {
              const comment = document.getElementById(`comment-${c.i}`);
              const code = document.getElementById(`code-${c.i}`);

              if (comment && code) {
                const commentRect = comment.getBoundingClientRect();
                const codeRect = code.getBoundingClientRect();
                const codeBottom =
                  codeRect.bottom +
                  scrollTop -
                  (code.dataset.last === 'true' ? 170 : 205); // calculate code bottom relative to parent
                const maxTranslateY = Math.max(
                  0,
                  Math.min(
                    scrollTop,
                    codeBottom - commentRect.height - previousCommentsHeight,
                  ),
                );
                previousCommentsHeight += commentRect.height + 12;
                comment.style.transform = `translateY(${maxTranslateY}px)`;
              }
            });
          });
        },
        75,
        { trailing: true, leading: true },
      ),
    [citations],
  );

  return (
    <div
      className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content"
      ref={containerRef}
      onScroll={handleScroll}
    >
      {containerRef.current &&
        containerRef.current.scrollHeight - containerRef.current.clientHeight >
          180 &&
        !isScrolled && (
          <div className="fixed z-30 left-1/2 bottom-24 transform -translate-x-1/2">
            <div
              className={`rounded-full bg-bg-main text-white shadow-small caption 
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
        <CodeAnnotation
          repoName={tab.repoName}
          repoRef={tab.key}
          citations={citations}
        />
        {otherBlocks.map((b, i) => {
          if ('New' in b && b.New.code && b.New.language) {
            return (
              <NewCode code={b.New.code} language={b.New.language} key={i} />
            );
          } else if ('Modify' in b && b.Modify.diff) {
            return <DiffCode data={b.Modify} key={i} />;
          }
        })}
      </div>
    </div>
  );
};

export default ConversationResult;
