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
  StudioTabType,
  ChatTabType,
  FileTabType,
  TabType,
  TabTypesEnum,
} from '../../types/general';
import { ProjectContext } from '../projectContext';
import { CommandBarContext } from '../commandBarContext';
import { checkEventKeys } from '../../utils/keyboardUtils';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';
import { openTabsCache } from '../../services/cache';

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

  useEffect(() => {
    openTabsCache.tabs = [...leftTabs, ...rightTabs];
  }, [leftTabs, rightTabs]);

  const openNewTab = useCallback(
    (
      data:
        | Omit<FileTabType, 'key'>
        | Omit<ChatTabType, 'key'>
        | Omit<StudioTabType, 'key'>,
      forceSide?: 'left' | 'right',
    ) => {
      let sideForNewTab =
        (!forceSide && focusedPanel === 'left') || forceSide === 'left'
          ? 'left'
          : 'right';
      if (
        data.type === TabTypesEnum.FILE &&
        leftTabs.length === 1 &&
        leftTabs[0].type === TabTypesEnum.CHAT &&
        !rightTabs.length
      ) {
        sideForNewTab = 'left';
        setRightTabs(leftTabs);
        setActiveRightTab(leftTabs[0]);
        setLeftTabs(() => []);
      }
      if (
        data.type === TabTypesEnum.CHAT &&
        leftTabs.length === 1 &&
        leftTabs[0].type === TabTypesEnum.FILE &&
        !rightTabs.length
      ) {
        sideForNewTab = 'right';
      }
      const setTabsAction =
        sideForNewTab === 'left' ? setLeftTabs : setRightTabs;
      const setActiveTabAction =
        sideForNewTab === 'left' ? setActiveLeftTab : setActiveRightTab;
      setTabsAction((prev) => {
        const newTab: TabType =
          data.type === TabTypesEnum.FILE
            ? {
                path: data.path,
                repoRef: data.repoRef,
                key: `${data.repoRef}-${data.path}`,
                scrollToLine: data.scrollToLine,
                branch: data.branch,
                type: TabTypesEnum.FILE,
                tokenRange: data.tokenRange,
                isTemp:
                  !data.tokenRange && !data.scrollToLine && !data.studioId,
                studioId: data.studioId,
                initialRanges: data.initialRanges,
                isFileInContext: data.isFileInContext,
              }
            : data.type === TabTypesEnum.CHAT
            ? {
                type: TabTypesEnum.CHAT,
                key: Date.now().toString(),
                initialQuery: data.initialQuery,
                conversationId: data.conversationId,
                title: data.title,
              }
            : {
                type: TabTypesEnum.STUDIO,
                key: data.studioId,
                studioId: data.studioId,
              };
        const previousTab = prev.find((t) =>
          newTab.type === TabTypesEnum.CHAT && newTab.conversationId
            ? t.type === TabTypesEnum.CHAT &&
              t.conversationId === newTab.conversationId
            : t.key === newTab.key ||
              (t.type === TabTypesEnum.FILE && t.isTemp),
        );
        if (!previousTab) {
          setActiveTabAction(newTab);
          return [...prev, newTab];
        } else {
          if (previousTab.type == TabTypesEnum.FILE && previousTab.isTemp) {
            setActiveTabAction(newTab);
            const newTabs = [...prev];
            newTabs[newTabs.length - 1] = newTab;
            return newTabs;
          } else if (
            previousTab.type === TabTypesEnum.FILE &&
            newTab.type === TabTypesEnum.FILE &&
            (previousTab.scrollToLine !== newTab.scrollToLine ||
              previousTab.tokenRange !== newTab.tokenRange ||
              previousTab.studioId !== newTab.studioId)
          ) {
            const previousTabIndex = prev.findIndex(
              (t) => t.key === newTab.key,
            );
            const newTabs = [...prev];
            const t = {
              ...previousTab,
              scrollToLine: newTab.scrollToLine,
              tokenRange: newTab.tokenRange,
              studioId: newTab.studioId,
            };
            newTabs[previousTabIndex] = t;
            setActiveTabAction(t);
            return newTabs;
          } else {
            setActiveTabAction(previousTab);
          }
        }
        return prev;
      });
    },
    [focusedPanel, leftTabs, rightTabs],
  );

  useEffect(() => {
    if (!rightTabs.length) {
      setFocusedPanel('left');
    }
  }, [rightTabs]);

  useEffect(() => {
    if (!leftTabs.length && rightTabs.length) {
      setLeftTabs(rightTabs);
      setRightTabs([]);
      setActiveLeftTab(activeRightTab);
      setActiveRightTab(null);
    }
  }, [rightTabs, leftTabs, activeRightTab]);

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
    <T extends ChatTabType | FileTabType | StudioTabType, K extends keyof T>(
      tabKey: string,
      objectKey: K,
      newValue: T[K],
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
        setActiveTabAction((prev) =>
          prev?.key === newTab.key ? newTab : prev,
        );
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

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, ['cmd', 'W'])) {
        e.preventDefault();
        e.stopPropagation();
        closeTab(
          focusedPanel === 'right' && activeRightTab?.key
            ? activeRightTab.key
            : activeLeftTab?.key || '',
          focusedPanel,
        );
      }
    },
    [closeTab, focusedPanel, activeLeftTab, activeRightTab],
  );
  useKeyboardNavigation(handleKeyEvent);

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
