import React, { useContext, useMemo } from 'react';
import PageHeader from '../../components/ResultsPageHeader';
import { ChatContext } from '../../context/chatContext';
import { ChatMessageServer, MessageResultCite } from '../../types/general';
import { UIContext } from '../../context/uiContext';
import NewCode from './NewCode';
import DiffCode from './DiffCode';
import CodeAnnotation from './CodeAnnotation';

type Props = {
  recordId: number;
};

const ConversationResult = ({ recordId }: Props) => {
  const { conversation } = useContext(ChatContext);
  const { tab } = useContext(UIContext);
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
  return (
    <div className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content">
      <PageHeader
        resultsNumber={data?.length}
        showCollapseControls={false}
        loading={false}
      />
      <div className="flex flex-col gap-4">
        {Object.entries(citations).map(([file, citations], i) => {
          return (
            <CodeAnnotation
              key={i}
              repoName={tab.name}
              filePath={file}
              citations={citations}
            />
          );
        })}
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
