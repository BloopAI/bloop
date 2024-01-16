import React, { memo, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useDragLayer } from 'react-dnd';
import { ProjectContext } from '../context/projectContext';
import { TabsContext } from '../context/tabsContext';
import { TabType, TabTypesEnum } from '../types/general';
import ChatsContextProvider from '../context/providers/ChatsContextProvider';
import { UIContext } from '../context/uiContext';
import { checkEventKeys } from '../utils/keyboardUtils';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import StudiosContextProvider from '../context/providers/StudiosContextProvider';
import LeftSidebar from './LeftSidebar';
import CurrentTabContent from './CurrentTabContent';
import EmptyProject from './EmptyProject';
import DropTarget from './CurrentTabContent/DropTarget';
import RightTab from './RightTab';
import ChatPersistentState from './CurrentTabContent/ChatTab/ChatPersistentState';
import StudioPersistentState from './CurrentTabContent/StudioTab/StudioPersistentState';

type Props = {};

const Project = ({}: Props) => {
  useTranslation();
  const { project } = useContext(ProjectContext.Current);
  const { rightTabs, leftTabs } = useContext(TabsContext.All);
  const { setIsLeftSidebarFocused } = useContext(UIContext.Focus);
  const {
    setActiveRightTab,
    setActiveLeftTab,
    setLeftTabs,
    setFocusedPanel,
    setRightTabs,
  } = useContext(TabsContext.Handlers);
  const { isDragging } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
  }));

  const onDropToRight = useCallback((tab: TabType) => {
    setRightTabs((prev) =>
      prev.find((t) => t.key === tab.key)
        ? prev
        : [
            ...prev,
            tab.type === TabTypesEnum.FILE && tab.isTemp
              ? { ...tab, isTemp: false }
              : tab,
          ],
    );
    setLeftTabs((prev) => {
      const newTabs = prev.filter((s) => s.key !== tab.key);
      setActiveLeftTab(newTabs[newTabs.length - 1]);
      return newTabs;
    });
    setActiveRightTab(tab);
    setFocusedPanel('right');
  }, []);

  const onDropToLeft = useCallback((tab: TabType) => {
    setLeftTabs((prev) =>
      prev.find((t) => t.key === tab.key)
        ? prev
        : [
            ...prev,
            tab.type === TabTypesEnum.FILE && tab.isTemp
              ? { ...tab, isTemp: false }
              : tab,
          ],
    );
    setRightTabs((prev) => {
      const newTabs = prev.filter((s) => s.key !== tab.key);
      setActiveRightTab(newTabs[newTabs.length - 1]);
      return newTabs;
    });
    setActiveLeftTab(tab);
    setFocusedPanel('left');
  }, []);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, ['cmd', '1'])) {
        e.preventDefault();
        e.stopPropagation();
        setFocusedPanel('left');
        setIsLeftSidebarFocused(false);
      } else if (checkEventKeys(e, ['cmd', '2']) && rightTabs.length) {
        e.preventDefault();
        e.stopPropagation();
        setFocusedPanel('right');
        setIsLeftSidebarFocused(false);
      }
    },
    [rightTabs.length],
  );
  useKeyboardNavigation(handleKeyEvent);

  return !project?.repos?.length ? (
    <EmptyProject />
  ) : (
    <div className="w-screen h-screen flex relative overflow-hidden scrollbar-hide">
      <LeftSidebar />
      <ChatsContextProvider>
        <StudiosContextProvider>
          <div className="flex-1 overflow-hidden relative">
            <CurrentTabContent
              side="left"
              onDrop={onDropToLeft}
              moveToAnotherSide={onDropToRight}
              shouldStretch
            />
            {!rightTabs.length && isDragging ? (
              <DropTarget onDrop={onDropToRight} />
            ) : null}
          </div>
          {!!rightTabs.length && (
            <RightTab
              onDropToRight={onDropToRight}
              moveToAnotherSide={onDropToLeft}
            />
          )}
          {[...leftTabs, ...rightTabs].map((t, i) =>
            t.type === TabTypesEnum.CHAT ? (
              <ChatPersistentState
                key={t.key}
                tabKey={t.key}
                tabTitle={t.title}
                conversationId={t.conversationId}
                initialQuery={t.initialQuery}
                side={i < leftTabs.length ? 'left' : 'right'}
              />
            ) : t.type === TabTypesEnum.STUDIO ? (
              <StudioPersistentState
                key={t.key}
                tabKey={t.key}
                tabTitle={t.title}
                studioId={t.studioId}
                side={i < leftTabs.length ? 'left' : 'right'}
              />
            ) : null,
          )}
        </StudiosContextProvider>
      </ChatsContextProvider>
    </div>
  );
};

export default memo(Project);
