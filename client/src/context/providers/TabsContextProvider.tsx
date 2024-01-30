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
  DocTabType,
  FileTabType,
  StudioTabType,
  TabType,
  TabTypesEnum,
} from '../../types/general';
import { ProjectContext } from '../projectContext';
import { CommandBarContext } from '../commandBarContext';
import { checkEventKeys } from '../../utils/keyboardUtils';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';
import { openTabsCache } from '../../services/cache';
import { RECENT_FILES_KEY, updateArrayInStorage } from '../../services/storage';
import { UIContext } from '../uiContext';
import { closeTabShortcut } from '../../consts/shortcuts';

type Props = {};

const TabsContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const {
    project,
    isReposLoaded,
    isChatsLoaded,
    isStudiosLoaded,
    isDocsLoaded,
    isLoading: isLoadingProjects,
  } = useContext(ProjectContext.Current);
  const { setFocusedTabItems } = useContext(CommandBarContext.Handlers);
  const { setOnBoardingState } = useContext(UIContext.Onboarding);
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
        | Omit<DocTabType, 'key'>
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
        [TabTypesEnum.CHAT, TabTypesEnum.STUDIO].includes(leftTabs[0].type) &&
        !rightTabs.length
      ) {
        sideForNewTab = 'left';
        setRightTabs(leftTabs);
        setActiveRightTab(leftTabs[0]);
        setLeftTabs(() => []);
      }
      if (data.type === TabTypesEnum.CHAT) {
        setOnBoardingState((prev) =>
          prev.isChatOpened ? prev : { ...prev, isChatOpened: true },
        );
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
            : data.type === TabTypesEnum.STUDIO
            ? {
                type: TabTypesEnum.STUDIO,
                key: data.studioId.toString(),
                studioId: data.studioId.toString(),
                snapshot: data.snapshot,
              }
            : {
                ...data,
                type: TabTypesEnum.DOC,
                key: 'doc-' + data.docId + data.relativeUrl,
              };
        if (newTab.type === TabTypesEnum.FILE) {
          updateArrayInStorage(
            RECENT_FILES_KEY,
            `${newTab.repoRef}:${newTab.path}:${newTab.branch || ''}`,
          );
        }
        const previousTab = prev.find((t) =>
          newTab.type === TabTypesEnum.CHAT && newTab.conversationId
            ? t.type === TabTypesEnum.CHAT &&
              t.conversationId === newTab.conversationId
            : (t.key === newTab.key && t.type === newTab.type) ||
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
          } else if (
            previousTab.type === TabTypesEnum.DOC &&
            newTab.type === TabTypesEnum.DOC &&
            (previousTab.studioId !== newTab.studioId ||
              previousTab.initialSections != newTab.initialSections)
          ) {
            const previousTabIndex = prev.findIndex(
              (t) => t.key === newTab.key,
            );
            const newTabs = [...prev];
            const t = {
              ...previousTab,
              studioId: newTab.studioId,
              initialSections: newTab.initialSections,
            };
            newTabs[previousTabIndex] = t;
            setActiveTabAction(t);
            return newTabs;
          } else if (
            previousTab.type === TabTypesEnum.STUDIO &&
            newTab.type === TabTypesEnum.STUDIO &&
            previousTab.snapshot !== newTab.snapshot
          ) {
            const previousTabIndex = prev.findIndex(
              (t) => t.key === newTab.key,
            );
            const newTabs = [...prev];
            const t = {
              ...previousTab,
              snapshot: newTab.snapshot,
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
        } else if (activeTab.type === TabTypesEnum.STUDIO) {
          if (activeTab.studioId) {
            newParams.studioId = activeTab.studioId;
          }
          if (activeTab.title) {
            newParams.title = activeTab.title;
          }
        } else if (activeTab.type === TabTypesEnum.DOC) {
          if (activeTab.docId) {
            newParams.docId = activeTab.docId;
          }
          if (activeTab.title) {
            newParams.title = activeTab.title;
          }
          if (activeTab.favicon) {
            newParams.favicon = activeTab.favicon;
          }
          if (activeTab.relativeUrl) {
            newParams.relativeUrl = activeTab.relativeUrl;
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
      const studioId = searchParams.get('studioId');
      const docId = searchParams.get('docId');
      if (!activeLeftTab && (path || conversationId || studioId || docId)) {
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
        } else if (docId) {
          openNewTab({
            type: TabTypesEnum.DOC,
            docId,
            title: searchParams.get('title') || undefined,
            favicon: searchParams.get('favicon') || undefined,
            relativeUrl: searchParams.get('relativeUrl')!,
          });
        } else if (studioId) {
          openNewTab({
            type: TabTypesEnum.STUDIO,
            studioId,
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

  const closeCurrentTab = useCallback(() => {
    if (focusedPanel === 'left' && activeLeftTab) {
      closeTab(activeLeftTab.key, focusedPanel);
    } else if (focusedPanel === 'right' && activeRightTab) {
      closeTab(activeRightTab.key, focusedPanel);
    }
  }, [activeLeftTab, activeRightTab, focusedPanel, closeTab]);

  const updateTabProperty = useCallback(
    <
      T extends ChatTabType | FileTabType | StudioTabType | DocTabType,
      K extends keyof T,
    >(
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

  const checkIfTabsShouldClose = useCallback(
    (checkIfTabShouldClose: (t: TabType | null) => boolean) => {
      if (!isLoading && !isLoadingProjects) {
        setActiveLeftTab((prev) => (checkIfTabShouldClose(prev) ? null : prev));
        setActiveRightTab((prev) =>
          checkIfTabShouldClose(prev) ? null : prev,
        );
        setLeftTabs((prev) => prev.filter((t) => !checkIfTabShouldClose(t)));
        setRightTabs((prev) => prev.filter((t) => !checkIfTabShouldClose(t)));
      }
    },
    [isLoading, isLoadingProjects],
  );

  useEffect(() => {
    if (isReposLoaded && project?.repos && !isLoading && !isLoadingProjects) {
      const checkIfTabShouldClose = (tab: TabType | null) =>
        tab?.type === TabTypesEnum.FILE &&
        !project.repos.find((r) => r.repo.ref === tab.repoRef);
      checkIfTabsShouldClose(checkIfTabShouldClose);
    }
  }, [isReposLoaded, project?.repos, checkIfTabsShouldClose]);

  useEffect(() => {
    if (
      isChatsLoaded &&
      project?.conversations &&
      !isLoading &&
      !isLoadingProjects
    ) {
      const checkIfTabShouldClose = (tab: TabType | null) =>
        tab?.type === TabTypesEnum.CHAT &&
        !!tab.conversationId &&
        !project.conversations.find((r) => r.id === tab.conversationId);
      checkIfTabsShouldClose(checkIfTabShouldClose);
    }
  }, [isChatsLoaded, project?.conversations, checkIfTabsShouldClose]);

  useEffect(() => {
    if (
      isStudiosLoaded &&
      project?.studios &&
      !isLoading &&
      !isLoadingProjects
    ) {
      const checkIfTabShouldClose = (tab: TabType | null) =>
        tab?.type === TabTypesEnum.STUDIO &&
        !project.studios.find(
          (r) => r.id.toString() === tab.studioId.toString(),
        );
      checkIfTabsShouldClose(checkIfTabShouldClose);
    }
  }, [isStudiosLoaded, project?.studios, checkIfTabsShouldClose]);

  useEffect(() => {
    if (isDocsLoaded && project?.docs && !isLoading && !isLoadingProjects) {
      const checkIfTabShouldClose = (tab: TabType | null) =>
        tab?.type === TabTypesEnum.DOC &&
        !project.docs.find((r) => r.id === tab.docId);
      checkIfTabsShouldClose(checkIfTabShouldClose);
    }
  }, [isDocsLoaded, project?.docs, checkIfTabsShouldClose]);

  const handlersContextValue = useMemo(
    () => ({
      closeTab,
      closeCurrentTab,
      openNewTab,
      setActiveLeftTab,
      setActiveRightTab,
      setFocusedPanel,
      setLeftTabs,
      setRightTabs,
      updateTabProperty,
    }),
    [closeTab, openNewTab, updateTabProperty, closeCurrentTab],
  );

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, closeTabShortcut)) {
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
    }),
    [leftTabs, rightTabs],
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

  const focusedPanelContextValue = useMemo(
    () => ({
      focusedPanel,
    }),
    [focusedPanel],
  );

  return (
    <TabsContext.Handlers.Provider value={handlersContextValue}>
      <TabsContext.All.Provider value={allContextValue}>
        <TabsContext.CurrentLeft.Provider value={currentLeftContextValue}>
          <TabsContext.CurrentRight.Provider value={currentRightContextValue}>
            <TabsContext.FocusedPanel.Provider value={focusedPanelContextValue}>
              {children}
            </TabsContext.FocusedPanel.Provider>
          </TabsContext.CurrentRight.Provider>
        </TabsContext.CurrentLeft.Provider>
      </TabsContext.All.Provider>
    </TabsContext.Handlers.Provider>
  );
};

export default memo(TabsContextProvider);
