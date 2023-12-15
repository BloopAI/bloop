import {
  memo,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { TabsContext } from '../tabsContext';
import {
  ChatTabType,
  FileTabType,
  TabType,
  TabTypesEnum,
} from '../../types/general';
import { ProjectContext } from '../projectContext';
import { CommandBarContext } from '../commandBarContext';

type Props = {};

const TabsContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const {
    project,
    isReposLoaded,
    isLoading: isLoadingProjects,
  } = useContext(ProjectContext.Current);
  const { setFocusedTabItems } = useContext(CommandBarContext.Handlers);
  const [leftTabs, setLeftTabs] = useState<TabType[]>([]);
  const [rightTabs, setRightTabs] = useState<TabType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLeftTab, setActiveLeftTab] = useState<TabType | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<TabType | null>(null);
  const [focusedPanel, setFocusedPanel] = useState<'left' | 'right'>('left');
  const [searchParams, setSearchParams] = useSearchParams();

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

  useEffect(() => {
    if (!isLoadingProjects && !isLoading) {
      const activeTab =
        focusedPanel === 'left' ? activeLeftTab : activeRightTab;
      if (!activeTab) {
        setFocusedTabItems([]);
        setSearchParams('', { replace: true });
      } else {
        const newParams: Record<string, string> = {};
        if (activeTab.type === TabTypesEnum.FILE) {
          newParams.path = activeTab.path;
          newParams.repoRef = activeTab.repoRef;
          if (activeTab.branch) {
            newParams.branch = activeTab.branch;
          }
          if (activeTab.scrollToLine) {
            newParams.scrollToLine = activeTab.scrollToLine;
          }
          if (activeTab.tokenRange) {
            newParams.tokenRange = activeTab.tokenRange;
          }
        } else if (activeTab.type === TabTypesEnum.CHAT) {
          if (activeTab.conversationId) {
            newParams.conversationId = activeTab.conversationId;
          }
          if (activeTab.title) {
            newParams.title = activeTab.title;
          }
        }
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [
    focusedPanel,
    activeLeftTab,
    activeRightTab,
    isLoadingProjects,
    isLoading,
  ]);

  useEffect(() => {
    if (!isLoadingProjects) {
      const path = searchParams.get('path');
      const conversationId = searchParams.get('conversationId');
      if (!activeLeftTab && (path || conversationId)) {
        const repoRef = searchParams.get('repoRef');
        if (path && repoRef) {
          openNewTab({
            type: TabTypesEnum.FILE,
            path,
            repoRef,
            branch: searchParams.get('branch'),
            scrollToLine: searchParams.get('scrollToLine') || undefined,
            tokenRange: searchParams.get('tokenRange') || undefined,
          });
        } else if (conversationId) {
          openNewTab({
            type: TabTypesEnum.CHAT,
            conversationId,
            title: searchParams.get('title') || undefined,
          });
        }
      }
      setIsLoading(false);
    }
  }, [isLoadingProjects]);

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

  const updateTabProperty = useCallback(
    (
      tabKey: string,
      objectKey: keyof ChatTabType,
      newValue: string,
      side: 'left' | 'right',
    ) => {
      const setTabsAction = side === 'left' ? setLeftTabs : setRightTabs;
      const setActiveTabAction =
        side === 'left' ? setActiveLeftTab : setActiveRightTab;
      setTabsAction((prevTabs) => {
        const newTabs = [...prevTabs];
        const oldTabIndex = prevTabs.findIndex((t) => t.key === tabKey);
        const newTab = { ...newTabs[oldTabIndex], [objectKey]: newValue };
        newTabs[oldTabIndex] = newTab;
        setActiveTabAction(newTab);
        return newTabs;
      });
    },
    [],
  );

  useEffect(() => {
    if (isReposLoaded && project?.repos && !isLoading && !isLoadingProjects) {
      const checkIfTabShouldClose = (tab: TabType | null) =>
        tab?.type === TabTypesEnum.FILE &&
        !project.repos.find((r) => r.repo.ref === tab.repoRef);
      setActiveLeftTab((prev) => (checkIfTabShouldClose(prev) ? null : prev));
      setActiveRightTab((prev) => (checkIfTabShouldClose(prev) ? null : prev));
      setLeftTabs((prev) => prev.filter((t) => !checkIfTabShouldClose(t)));
      setRightTabs((prev) => prev.filter((t) => !checkIfTabShouldClose(t)));
    }
  }, [isReposLoaded, project?.repos, isLoading, isLoadingProjects]);

  const handlersContextValue = useMemo(
    () => ({
      closeTab,
      openNewTab,
      setActiveLeftTab,
      setActiveRightTab,
      setFocusedPanel,
      setLeftTabs,
      setRightTabs,
      updateTabProperty,
    }),
    [closeTab, openNewTab, updateTabProperty],
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
