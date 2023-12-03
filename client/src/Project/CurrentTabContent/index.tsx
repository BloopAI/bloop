import React, { memo, useContext } from 'react';
import { TabsContext } from '../../context/tabsContext';
import EmptyTab from './EmptyTab';
import FileTab from './FileTab';
import Header from './Header';

type Props = {};

const CurrentTabContent = ({}: Props) => {
  const { tab } = useContext(TabsContext.Current);
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />
      <div className="overflow-hidden h-full flex-1">
        {tab ? (
          <FileTab path={tab.path} repoName={tab.repoName} />
        ) : (
          <EmptyTab />
        )}
      </div>
    </div>
  );
};

export default memo(CurrentTabContent);
