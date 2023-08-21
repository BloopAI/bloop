import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DeviceContextType } from './context/deviceContext';
import './index.css';
import RepoTab from './pages/RepoTab';
import { TabsContext } from './context/tabsContext';
import {
  NavigationItem,
  RepoProvider,
  RepoTabType,
  RepoType,
  TabType,
  UITabType,
} from './types/general';
import {
  LAST_ACTIVE_TAB_KEY,
  saveJsonToStorage,
  savePlainToStorage,
  TABS_KEY,
} from './services/storage';
import { getRepos, initApi } from './services/api';
import { useComponentWillMount } from './hooks/useComponentWillMount';
import { RepoSource } from './types';
import { RepositoriesContext } from './context/repositoriesContext';
import { AnalyticsContextProvider } from './context/providers/AnalyticsContextProvider';
import { buildURLPart, getNavItemFromURL } from './utils/navigationUtils';
import { DeviceContextProvider } from './context/providers/DeviceContextProvider';
import useKeyboardNavigation from './hooks/useKeyboardNavigation';
import StudioTab from './pages/StudioTab';
import HomeTab from './pages/HomeTab';

type Props = {
  deviceContextValue: DeviceContextType;
};

function App({ deviceContextValue }: Props) {
  useComponentWillMount(() => initApi(deviceContextValue.apiUrl));

  const [tabs, setTabs] = useState<UITabType[]>([
    {
      key: 'initial',
      name: 'Home',
      type: TabType.HOME,
    },
  ]);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('initial');
  const [repositories, setRepositories] = useState<RepoType[] | undefined>();
  const [isLoading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const tab = tabs.find((t) => t.key === activeTab);
    if (tab && tab.type === TabType.REPO) {
      if (activeTab === 'initial') {
        navigate('/');
        return;
      }
      const lastNav = tab.navigationHistory[tab.navigationHistory.length - 1];
      navigate(
        `/${encodeURIComponent(tab.repoRef)}/${encodeURIComponent(
          tab.branch || 'all',
        )}/${lastNav ? buildURLPart(lastNav) : ''}`,
      );
    }
  }, [activeTab, tabs]);

  const handleAddTab = useCallback(
    (
      repoRef: string,
      repoName: string,
      name: string,
      source: RepoSource,
      branch?: string | null,
      navHistory?: NavigationItem[],
    ) => {
      const newTab = {
        key: repoRef + '#' + Date.now(),
        name,
        repoName,
        repoRef,
        source,
        branch,
        navigationHistory: navHistory || [],
        type: TabType.REPO,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTab(newTab.key);
    },
    [],
  );

  useEffect(() => {
    if (location.pathname === '/') {
      setLoading(false);
      return;
    }
    if (isLoading && repositories?.length) {
      const repo = repositories.find(
        (r) =>
          r.ref ===
          decodeURIComponent(location.pathname.slice(1).split('/')[0]),
      );
      if (repo) {
        const urlBranch = decodeURIComponent(location.pathname.split('/')[2]);
        handleAddTab(
          repo.ref,
          repo.provider === RepoProvider.GitHub ? repo.ref : repo.name,
          repo.name,
          repo.provider === RepoProvider.GitHub
            ? RepoSource.GH
            : RepoSource.LOCAL,
          urlBranch === 'all' ? null : urlBranch,
          getNavItemFromURL(
            location,
            repo.provider === RepoProvider.GitHub ? repo.ref : repo.name,
          ),
        );
      }
      setLoading(false);
    }
  }, [repositories, isLoading]);

  useEffect(() => {
    saveJsonToStorage(TABS_KEY, tabs);
  }, [tabs]);

  useEffect(() => {
    savePlainToStorage(LAST_ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!tabs.find((t) => t.key === activeTab)) {
      setActiveTab('initial');
    }
  }, [activeTab, tabs]);

  const handleRemoveTab = useCallback(
    (tabKey: string) => {
      setActiveTab((prev) => {
        const prevIndex = tabs.findIndex((t) => t.key === prev);
        if (tabKey === prev) {
          return prevIndex > 0
            ? tabs[prevIndex - 1].key
            : tabs[prevIndex + 1].key;
        }
        return prev;
      });
      setTabs((prev) => prev.filter((t) => t.key !== tabKey));
    },
    [tabs],
  );

  const updateTabNavHistory = useCallback(
    (tabKey: string, history: (prev: NavigationItem[]) => NavigationItem[]) => {
      setTabs((prev) => {
        const tabIndex = prev.findIndex((t) => t.key === tabKey);
        if (tabIndex < 0 || prev[tabIndex].type !== TabType.REPO) {
          return prev;
        }
        const newTab = {
          ...prev[tabIndex],
          navigationHistory: history(
            (prev[tabIndex] as RepoTabType).navigationHistory,
          ),
        };
        const newTabs = [...prev];
        newTabs[tabIndex] = newTab;
        return newTabs;
      });
    },
    [],
  );

  const updateTabBranch = useCallback(
    (tabKey: string, branch: null | string) => {
      setTabs((prev) => {
        const tabIndex = prev.findIndex((t) => t.key === tabKey);
        if (tabIndex < 0) {
          return prev;
        }
        const newTab = {
          ...prev[tabIndex],
          branch,
        };
        const newTabs = [...prev];
        newTabs[tabIndex] = newTab;
        return newTabs;
      });
    },
    [],
  );

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const num = Number(e.key);
        if (Object.keys(tabs).includes((num - 1).toString())) {
          const newTab = tabs[num - 1]?.key;
          if (newTab) {
            e.preventDefault();
            setActiveTab(newTab);
          }
        } else if (e.key === 'w' && activeTab !== 'initial') {
          e.preventDefault();
          e.stopPropagation();
          handleRemoveTab(activeTab);
          return true;
        }
      }
    },
    [tabs, activeTab],
  );
  useKeyboardNavigation(handleKeyEvent);

  const contextValue = useMemo(
    () => ({
      tabs,
      activeTab,
      handleAddTab,
      handleRemoveTab,
      setActiveTab,
      updateTabNavHistory,
      updateTabBranch,
    }),
    [
      tabs,
      activeTab,
      handleAddTab,
      handleRemoveTab,
      updateTabNavHistory,
      updateTabBranch,
    ],
  );

  const fetchRepos = useCallback(() => {
    getRepos().then((data) => {
      const list = data?.list?.sort((a, b) => (a.name < b.name ? -1 : 1)) || [];
      setRepositories((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(list)) {
          return prev;
        }
        return list;
      });
    });
  }, []);

  useEffect(() => {
    fetchRepos();
    const intervalId = setInterval(fetchRepos, 5000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const reposContextValue = useMemo(
    () => ({
      repositories,
      setRepositories,
      localSyncError: false,
      githubSyncError: false,
      fetchRepos,
    }),
    [repositories],
  );

  return (
    <DeviceContextProvider deviceContextValue={deviceContextValue}>
      <AnalyticsContextProvider
        forceAnalytics={deviceContextValue.forceAnalytics}
        isSelfServe={deviceContextValue.isSelfServe}
        envConfig={deviceContextValue.envConfig}
      >
        <RepositoriesContext.Provider value={reposContextValue}>
          <TabsContext.Provider value={contextValue}>
            {tabs.map((t) =>
              t.type === TabType.STUDIO ? (
                <StudioTab key={t.key} isActive={t.key === activeTab} tab={t} />
              ) : t.type === TabType.REPO ? (
                <RepoTab key={t.key} isActive={t.key === activeTab} tab={t} />
              ) : (
                <HomeTab key={t.key} isActive={t.key === activeTab} tab={t} />
              ),
            )}
          </TabsContext.Provider>
        </RepositoriesContext.Provider>
      </AnalyticsContextProvider>
    </DeviceContextProvider>
  );
}

export default App;
