import React, { memo, useContext } from 'react';
import HeaderRightPart from '../../../components/Header/HeaderRightPart';
import { TabsContext } from '../../../context/tabsContext';
import AddTabButton from './AddTabButton';
import TabButton from './TabButton';

type Props = {};

const ProjectHeader = ({}: Props) => {
  const { tabs } = useContext(TabsContext.All);
  const { tab } = useContext(TabsContext.Current);
  return (
    <div className="flex justify-between items-center h-10 border-b border-bg-border overflow-hidden">
      <div className="flex pl-4 pr-2 items-center gap-1 flex-1 h-full overflow-auto fade-right">
        {tabs.map(({ key, ...t }) => (
          <TabButton
            key={key}
            {...t}
            tabKey={key}
            isActive={tab?.key === key}
          />
        ))}
        {!!tabs.length && <div className="h-3 w-px bg-bg-border mx-1" />}
        <AddTabButton />
      </div>
      <div className="border-l border-bg-border h-full">
        <HeaderRightPart />
      </div>
    </div>
  );
};

export default memo(ProjectHeader);
