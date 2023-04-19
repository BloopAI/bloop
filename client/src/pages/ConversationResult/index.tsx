import React, { useContext, useMemo } from 'react';
import PageHeader from '../../components/ResultsPageHeader';
import { ChatContext } from '../../context/chatContext';
import { ChatMessageServer } from '../../types/general';
import NewCode from './NewCode';
import DiffCode from './DiffCode';

type Props = {
  recordId: number;
};

const ConversationResult = ({ recordId }: Props) => {
  const { conversation } = useContext(ChatContext);
  const data = useMemo(
    () =>
      (conversation[recordId] as ChatMessageServer)?.fullAnswer?.filter(
        (p) => p[0] !== 'cite' && p[0] !== 'con',
      ) || [],
    [conversation[recordId]],
  );
  return (
    <div className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content">
      <PageHeader
        resultsNumber={data?.length}
        showCollapseControls={false}
        loading={false}
      />
      <div className="flex flex-col gap-4">
        {data.map((d, i) => {
          if (d[0] === 'new' && d[2]) {
            return <NewCode code={d[2]} language={d[1]} key={i} />;
          } else if (d[0] === 'mod' && d[2]?.hunks) {
            return <DiffCode data={d[2]} key={i} />;
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default ConversationResult;
