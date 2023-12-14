import {
  memo,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { TabsContext } from '../tabsContext';
import {
  ChatTabType,
  FileTabType,
  TabType,
  TabTypesEnum,
} from '../../types/general';
import { ProjectContext } from '../projectContext';

type Props = {};

const TabsContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const { project, isReposLoaded } = useContext(ProjectContext.Current);
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
            scrollToLine?: string;
            branch?: string | null;
            tokenRange?: string;
          }
        | {
            type: TabTypesEnum.CHAT;
            conversationId?: string;
            title?: string;
            initialQuery?: {
              path: string;
              lines: [number, number];
              repoRef: string;
              branch?: string | null;
            };
          },
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
          data.type === TabTypesEnum.FILE
            ? {
                path: data.path,
                repoRef: data.repoRef,
                key: `${data.repoRef}-${data.path}`,
                scrollToLine: data.scrollToLine,
                branch: data.branch,
                type: TabTypesEnum.FILE,
                tokenRange: data.tokenRange,
              }
            : {
                type: TabTypesEnum.CHAT,
                key: Date.now().toString(),
                initialQuery: data.initialQuery,
                conversationId: data.conversationId,
                title: data.title,
              };
        setActiveTabAction(newTab);
        const previousTab = prev.find((t) => t.key === newTab.key);
        if (!previousTab) {
          return [...prev, newTab];
        }
        if (
          previousTab &&
          previousTab.type === TabTypesEnum.FILE &&
          newTab.type === TabTypesEnum.FILE &&
          (previousTab.scrollToLine !== newTab.scrollToLine ||
            previousTab.tokenRange !== newTab.tokenRange)
        ) {
          const previousTabIndex = prev.findIndex((t) => t.key === newTab.key);
          const newTabs = [...prev];
          newTabs[previousTabIndex] = {
            ...previousTab,
            scrollToLine: newTab.scrollToLine,
            tokenRange: newTab.tokenRange,
          };
          return newTabs;
        }
        return prev;
      });
    },
    [focusedPanel, leftTabs],
  );

  useEffect(() => {
    if (!rightTabs.length) {
      setFocusedPanel('left');
    }
  }, [rightTabs]);

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

  const updateTabTitle = useCallback(
    (tabKey: string, newTitle: string, side: 'left' | 'right') => {
      const setTabsAction = side === 'left' ? setLeftTabs : setRightTabs;
      const setActiveTabAction =
        side === 'left' ? setActiveLeftTab : setActiveRightTab;
      setTabsAction((prevTabs) => {
        const newTabs = [...prevTabs];
        const oldTabIndex = prevTabs.findIndex((t) => t.key === tabKey);
        const newTab = { ...newTabs[oldTabIndex], title: newTitle };
        newTabs[oldTabIndex] = newTab;
        setActiveTabAction(newTab);
        return newTabs;
      });
    },
    [],
  );

  useEffect(() => {
    if (isReposLoaded && project?.repos) {
      const checkIfTabShouldClose = (tab: TabType | null) =>
        tab?.type === TabTypesEnum.FILE &&
        !project.repos.find((r) => r.repo.ref === tab.repoRef);
      setActiveLeftTab((prev) => (checkIfTabShouldClose(prev) ? null : prev));
      setActiveRightTab((prev) => (checkIfTabShouldClose(prev) ? null : prev));
      setLeftTabs((prev) => prev.filter((t) => !checkIfTabShouldClose(t)));
      setRightTabs((prev) => prev.filter((t) => !checkIfTabShouldClose(t)));
    }
  }, [isReposLoaded, project?.repos]);

  const handlersContextValue = useMemo(
    () => ({
      closeTab,
      openNewTab,
      setActiveLeftTab,
      setActiveRightTab,
      setFocusedPanel,
      setLeftTabs,
      setRightTabs,
      updateTabTitle,
    }),
    [closeTab, openNewTab, updateTabTitle],
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
