import React, { useContext, useMemo, useRef } from 'react';
import throttle from 'lodash.throttle';
import PageHeader from '../../components/ResultsPageHeader';
import { ChatContext } from '../../context/chatContext';
import { ChatMessageServer, MessageResultCite } from '../../types/general';
import { UIContext } from '../../context/uiContext';
import NewCode from './NewCode';
import DiffCode from './DiffCode';
import CodeAnnotation from './CodeAnotation';

type Props = {
  recordId: number;
};

const ConversationResult = ({ recordId }: Props) => {
  const { conversation } = useContext(ChatContext);
  const { tab } = useContext(UIContext);
  const containerRef = useRef<HTMLDivElement>(null);

  const data = useMemo(
    () => (conversation[recordId] as ChatMessageServer)?.results || [],
    [(conversation[recordId] as ChatMessageServer)?.results],
  );
  const citations = useMemo(() => {
    const files: Record<string, any> = {};
    data
      .filter((d): d is MessageResultCite => 'Cite' in d)
      .forEach((c, i) => {
        if (files[c.Cite.path]) {
          files[c.Cite.path].push({ ...c.Cite, i });
        } else if (c.Cite.path) {
          files[c.Cite.path] = [{ ...c.Cite, i }];
        }
      });
    return files;
  }, [data]);
  const otherBlocks = useMemo(() => data.filter((d) => !('Cite' in d)), [data]);

  const handleScroll = useMemo(
    () =>
      throttle((e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = (e.target as HTMLDivElement).scrollTop;
        let previousCommentsHeight = 0;
        Object.values(citations).forEach((fileCite) => {
          fileCite.forEach((c: any) => {
            const comment = document.getElementById(`comment-${c.i}`);
            const code = document.getElementById(`code-${c.i}`);

            if (comment && code) {
              const commentRect = comment.getBoundingClientRect();
              const codeRect = code.getBoundingClientRect();
              const codeBottom = codeRect.bottom + scrollTop - 170; // calculate code bottom relative to parent
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
      }, 300),
    [citations],
  );

  return (
    <div
      className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content"
      ref={containerRef}
      onScroll={handleScroll}
    >
      <PageHeader
        resultsNumber={data?.length}
        showCollapseControls={false}
        loading={false}
      />
      <div className="flex flex-col gap-4">
        <CodeAnnotation repoName={tab.repoName} citations={citations} />
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
