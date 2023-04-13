import React, { useMemo } from 'react';
import { conversationsCache } from '../../services/cache';
import PageHeader from '../../components/ResultsPageHeader';
import NewCode from './NewCode';

type Props = {
  recordId: string;
};

const ConversationResult = ({ recordId }: Props) => {
  const data = useMemo(() => conversationsCache[recordId], [recordId]);
  return (
    <div className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content">
      <PageHeader
        resultsNumber={data.data?.length}
        showCollapseControls={false}
        loading={false}
      />
      {data.type === 'new-code' && <NewCode {...data.data[0]} />}
    </div>
  );
};

export default ConversationResult;
