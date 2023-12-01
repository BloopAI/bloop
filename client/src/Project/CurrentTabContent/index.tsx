import React, { memo, useContext } from 'react';
import { TabsContext } from '../../context/tabsContext';
import EmptyTab from './EmptyTab';
import FileTab from './FileTab';

type Props = {};

const CurrentTabContent = ({}: Props) => {
  const { tab } = useContext(TabsContext.Current);
  return (
    <div className="overflow-hidden h-full">
      {tab ? <FileTab path={tab.path} repoName={tab.repoName} /> : <EmptyTab />}
    </div>
  );
};

export default memo(CurrentTabContent);
