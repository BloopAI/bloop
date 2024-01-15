import React, { memo, useCallback, useContext, useMemo } from 'react';
import HeaderRightPart from '../../../components/Header/HeaderRightPart';
import { TabsContext } from '../../../context/tabsContext';
import { TabType, TabTypesEnum } from '../../../types/general';
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
  const { setLeftTabs, setRightTabs, setActiveRightTab, setActiveLeftTab } =
    useContext(TabsContext.Handlers);
  const tabs = useMemo(() => {
    return side === 'left' ? leftTabs : rightTabs;
  }, [side, rightTabs, leftTabs]);

  const moveTab = useCallback(
    (
      dragIndex: number,
      hoverIndex: number,
      sourceSide: 'left' | 'right',
      targetSide: 'left' | 'right',
    ) => {
      if (sourceSide === targetSide) {
        const action = side === 'left' ? setLeftTabs : setRightTabs;
        action((prevTabs) => {
          const newTabs = JSON.parse(JSON.stringify(prevTabs));
          newTabs.splice(dragIndex, 1);
          const newTab = prevTabs[dragIndex];
          newTabs.splice(
            hoverIndex,
            0,
            newTab.type === TabTypesEnum.FILE && newTab.isTemp
              ? { ...newTab, isTemp: false }
              : newTab,
          );
          return newTabs;
        });
      } else {
        const sourceAction = sourceSide === 'left' ? setLeftTabs : setRightTabs;
        const sourceTabAction =
          sourceSide === 'left' ? setActiveLeftTab : setActiveRightTab;
        const targetAction = targetSide === 'left' ? setLeftTabs : setRightTabs;
        const targetTabAction =
          targetSide === 'left' ? setActiveLeftTab : setActiveRightTab;

        sourceAction((prevSourceTabs) => {
          const newSourceTabs = JSON.parse(JSON.stringify(prevSourceTabs));
          const [movedTab] = newSourceTabs.splice(dragIndex, 1);
          sourceTabAction(
            newSourceTabs.length
              ? newSourceTabs[dragIndex - 1] || newSourceTabs[0]
              : null,
          );

          targetAction((prevTargetTabs) => {
            const newTargetTabs = JSON.parse(JSON.stringify(prevTargetTabs));
            if (!newTargetTabs.find((t: TabType) => t.key === movedTab.key)) {
              newTargetTabs.splice(hoverIndex, 0, movedTab);
            }
            targetTabAction(movedTab);
            return newTargetTabs;
          });

          return newSourceTabs;
        });
      }
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
            focusedPanel={focusedPanel}
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
