import React, { memo, useCallback, useContext } from 'react';
import { useDrop } from 'react-dnd';
import { Trans } from 'react-i18next';
import { TabsContext } from '../../context/tabsContext';
import { DraggableTabItem, TabType, TabTypesEnum } from '../../types/general';
import { SplitViewIcon } from '../../icons';
import { UIContext } from '../../context/uiContext';
import EmptyTab from './EmptyTab';
import FileTab from './FileTab';
import Header from './Header';
import ChatTab from './ChatTab';
import StudioTab from './StudioTab';
import DocTab from './DocTab';

type Props = {
  side: 'left' | 'right';
  onDrop: (t: TabType) => void;
  moveToAnotherSide: (t: TabType) => void;
  shouldStretch?: boolean;
};

const CurrentTabContent = ({
  side,
  onDrop,
  shouldStretch,
  moveToAnotherSide,
}: Props) => {
  const { tab } = useContext(
    TabsContext[side === 'left' ? 'CurrentLeft' : 'CurrentRight'],
  );
  const { setFocusedPanel } = useContext(TabsContext.Handlers);
  const { setIsLeftSidebarFocused } = useContext(UIContext.Focus);

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: side === 'right' ? 'tab-left' : 'tab-right',
      canDrop: (i: DraggableTabItem) => i.side !== side,
      drop: (item: DraggableTabItem) => {
        onDrop(item.t);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [onDrop],
  );

  const focusPanel = useCallback(() => {
    setFocusedPanel(side);
    setIsLeftSidebarFocused(false);
  }, [side]);

  const handleMoveToAnotherSide = useCallback(() => {
    if (tab) {
      moveToAnotherSide(tab);
    }
  }, [moveToAnotherSide, tab]);

  return (
    <div
      className={`${
        shouldStretch ? 'flex-1' : ''
      } h-full flex flex-col overflow-hidden`}
      onClick={focusPanel}
    >
      <Header side={side} />
      <div className="overflow-hidden h-full flex-1 relative" ref={drop}>
        {tab?.type === TabTypesEnum.FILE ? (
          <FileTab
            {...tab}
            key={tab.key}
            tabKey={tab.key}
            noBorder={side === 'left'}
            side={side}
            handleMoveToAnotherSide={handleMoveToAnotherSide}
          />
        ) : tab?.type === TabTypesEnum.CHAT ? (
          <ChatTab
            {...tab}
            noBorder={side === 'left'}
            side={side}
            tabKey={tab.key}
            key={tab.key}
            handleMoveToAnotherSide={handleMoveToAnotherSide}
          />
        ) : tab?.type === TabTypesEnum.STUDIO ? (
          <StudioTab
            {...tab}
            noBorder={side === 'left'}
            side={side}
            tabKey={tab.key}
            key={tab.key}
            handleMoveToAnotherSide={handleMoveToAnotherSide}
          />
        ) : tab?.type === TabTypesEnum.DOC ? (
          <DocTab
            {...tab}
            noBorder={side === 'left'}
            side={side}
            tabKey={tab.key}
            key={tab.key}
            handleMoveToAnotherSide={handleMoveToAnotherSide}
          />
        ) : (
          <EmptyTab />
        )}
        {isOver && canDrop && (
          <div className="absolute top-0 bottom-0 left-0 right-0 bg-bg-sub">
            <div className="absolute w-full h-full bg-bg-selected flex flex-col">
              <div className="h-10 border-b border-bg-border w-full" />
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-3 text-label-base body-s-b">
                  <SplitViewIcon sizeClassName="w-4.5 h-4.5" />
                  <p>
                    <Trans>Release to open in split view</Trans>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(CurrentTabContent);
