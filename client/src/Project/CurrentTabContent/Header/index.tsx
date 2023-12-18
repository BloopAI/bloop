import React, { memo, useCallback, useContext, useMemo } from 'react';
import HeaderRightPart from '../../../components/Header/HeaderRightPart';
import { TabsContext } from '../../../context/tabsContext';
import AddTabButton from './AddTabButton';
import TabButton from './TabButton';

type Props = {
  side: 'left' | 'right';
};

const ProjectHeader = ({ side }: Props) => {
  const { leftTabs, rightTabs, focusedPanel } = useContext(TabsContext.All);
  const { tab } = useContext(
    TabsContext[side === 'left' ? 'CurrentLeft' : 'CurrentRight'],
  );
  const { setLeftTabs, setRightTabs } = useContext(TabsContext.Handlers);
  const tabs = useMemo(() => {
    return side === 'left' ? leftTabs : rightTabs;
  }, [side, rightTabs, leftTabs]);

  const moveTab = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      const action = side === 'left' ? setLeftTabs : setRightTabs;
      action((prevTabs) => {
        const newTabs = JSON.parse(JSON.stringify(prevTabs));
        newTabs.splice(dragIndex, 1);
        newTabs.splice(hoverIndex, 0, prevTabs[dragIndex]);
        return newTabs;
      });
    },
    [side],
  );

  return (
    <div
      className={`flex justify-between items-center h-10 border-b border-bg-border overflow-hidden select-none ${
        side === 'right' ? 'border-l border-bg-border' : ''
      }`}
    >
      <div
        className="flex pl-4 pr-2 items-center gap-1 flex-1 h-full overflow-auto fade-right"
        data-tauri-drag-region
      >
        {tabs.map(({ key, ...t }, i) => (
          <TabButton
            key={key}
            {...t}
            tabKey={key}
            isActive={tab?.key === key}
            side={side}
            isOnlyTab={tabs.length === 1}
            moveTab={moveTab}
            i={i}
          />
        ))}
        {!!tabs.length && <div className="h-3 w-px bg-bg-border mx-1" />}
        <AddTabButton
          tabsLength={tabs.length}
          side={side}
          focusedPanel={focusedPanel}
        />
      </div>
      {(side === 'right' || !rightTabs.length) && (
        <div className="border-l border-bg-border h-full">
          <HeaderRightPart />
        </div>
      )}
    </div>
  );
};

export default memo(ProjectHeader);
