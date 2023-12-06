import { memo, PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { TabsContext } from '../tabsContext';
import {
  ChatTabType,
  FileTabType,
  TabType,
  TabTypesEnum,
} from '../../types/general';

type Props = {};

const TabsContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const [leftTabs, setLeftTabs] = useState<TabType[]>([]);
  const [rightTabs, setRightTabs] = useState<TabType[]>([]);
  const [activeLeftTab, setActiveLeftTab] = useState<TabType | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<TabType | null>(null);
  const [focusedPanel, setFocusedPanel] = useState<'left' | 'right'>('left');

  const openNewTab = useCallback(
    (
      data:
        | {
            type: TabTypesEnum.FILE;
            path: string;
            repoRef: string;
            repoName: string;
            scrollToLine?: string;
            branch?: string | null;
          }
        | { type: TabTypesEnum.CHAT },
      forceSide?: 'left' | 'right',
    ) => {
      const setTabsAction =
        (!forceSide && focusedPanel === 'left') || forceSide === 'left'
          ? setLeftTabs
          : setRightTabs;
      const setActiveTabAction =
        (!forceSide && focusedPanel === 'left') || forceSide === 'left'
          ? setActiveLeftTab
          : setActiveRightTab;
      setTabsAction((prev) => {
        const newTab: FileTabType | ChatTabType =
          data.type === TabTypesEnum.FILE && data.path && data.repoRef
            ? {
                path: data.path,
                repoRef: data.repoRef,
                repoName: data.repoName,
                key: `${data.repoRef}-${data.path}`,
                scrollToLine: data.scrollToLine,
                branch: data.branch,
                type: TabTypesEnum.FILE,
              }
            : {
                type: TabTypesEnum.CHAT,
                key: Date.now().toString(),
              };
        setActiveTabAction(newTab);
        if (!prev.find((t) => t.key === newTab.key)) {
          return [...prev, newTab];
        }
        return prev;
      });
    },
    [focusedPanel, leftTabs],
  );

  const closeTab = useCallback((key: string, side: 'left' | 'right') => {
    const setTabsAction = side === 'left' ? setLeftTabs : setRightTabs;
    const setActiveTabAction =
      side === 'left' ? setActiveLeftTab : setActiveRightTab;
    setTabsAction((prevTabs) => {
      const newTabs = prevTabs.filter((t) => t.key !== key);
      setActiveTabAction((prev) => {
        if (!newTabs.length) {
          return null;
        }
        const prevIndex = prev
          ? prevTabs.findIndex((t) => t.key === prev.key)
          : -1;
        if (key === prev?.key) {
          return prevIndex > 0
            ? prevTabs[prevIndex - 1]
            : prevTabs[prevIndex + 1];
        }
        return prev;
      });
      return newTabs;
    });
  }, []);

  const handlersContextValue = useMemo(
    () => ({
      closeTab,
      openNewTab,
      setActiveLeftTab,
      setActiveRightTab,
      setFocusedPanel,
      setLeftTabs,
      setRightTabs,
    }),
    [closeTab, openNewTab],
  );

  const allContextValue = useMemo(
    () => ({
      leftTabs,
      rightTabs,
      focusedPanel,
    }),
    [leftTabs, rightTabs, focusedPanel],
  );

  const currentLeftContextValue = useMemo(
    () => ({
      tab: activeLeftTab,
    }),
    [activeLeftTab],
  );

  const currentRightContextValue = useMemo(
    () => ({
      tab: activeRightTab,
    }),
    [activeRightTab],
  );

  return (
    <TabsContext.Handlers.Provider value={handlersContextValue}>
      <TabsContext.All.Provider value={allContextValue}>
        <TabsContext.CurrentLeft.Provider value={currentLeftContextValue}>
          <TabsContext.CurrentRight.Provider value={currentRightContextValue}>
            {children}
          </TabsContext.CurrentRight.Provider>
        </TabsContext.CurrentLeft.Provider>
      </TabsContext.All.Provider>
    </TabsContext.Handlers.Provider>
  );
};

export default memo(TabsContextProvider);
