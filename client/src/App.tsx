import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DeviceContextType } from './context/deviceContext';
import './index.css';
import Tab from './Tab';
import { TabsContext } from './context/tabsContext';
import {
  NavigationItem,
  RepoProvider,
  RepoType,
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
import { getNavItemFromURL } from './utils/navigationUtils';
import { DeviceContextProvider } from './context/providers/DeviceContextProvider';
import useKeyboardNavigation from './hooks/useKeyboardNavigation';
import useUrlParser from './hooks/useUrlParser';

type Props = {
  deviceContextValue: DeviceContextType;
};

function App({ deviceContextValue }: Props) {
  useComponentWillMount(() => initApi(deviceContextValue.apiUrl));

  const [tabs, setTabs] = useState<UITabType[]>([
    {
      key: 'initial',
      name: 'Home',
      repoName: '',
      source: RepoSource.LOCAL,
      navigationHistory: [],
      currentUrl: '/',
    },
  ]);
  const location = useLocation();
  const navigateBrowser = useNavigate();
  const [repositories, setRepositories] = useState<RepoType[] | undefined>();
  const [isLoading, setLoading] = useState(true);
  const { repoRef, branch: urlBranch } = useUrlParser();

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
        key: repoRef,
        name,
        repoName,
        source,
        branch,
        navigationHistory: navHistory || [],
        currentUrl: `/${encodeURIComponent(repoRef)}/${encodeURIComponent(
          branch || 'all',
        )}/repo`,
      };
      setTabs((prev) => {
        const existing = prev.find((t) => t.key === newTab.key);
        if (existing) {
          navigateBrowser(existing.currentUrl);
          return prev;
        }
        return [...prev, newTab];
      });
      navigateBrowser(newTab.currentUrl);
    },
    [],
  );

  useEffect(() => {
    if (location.pathname === '/') {
      setLoading(false);
      return;
    }
    if (isLoading && repositories?.length) {
      const repo = repositories.find((r) => r.ref === repoRef);
      if (repo) {
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
    if (!isLoading && repositories) {
      if (location.pathname === '/') {
        return;
      }
      const repo = repositories.find((r) => r.ref === repoRef);
      if (repo) {
        const existingTab = tabs.find((t) => t.key === repo.ref);
        if (existingTab) {
        } else {
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
      }
    }
  }, [location.pathname, isLoading, repositories?.length]);

  useEffect(() => {
    // update currentUrl for tab on location change
    setTabs((prev) => {
      const currentTab = prev.findIndex((t) => t.key === repoRef);
      const newTabs = [...prev];
      newTabs[currentTab] = {
        ...newTabs[currentTab],
        currentUrl: location.pathname + location.search + location.hash,
      };
      return newTabs;
    });
  }, [location, repoRef]);

  useEffect(() => {
    saveJsonToStorage(TABS_KEY, tabs);
  }, [tabs]);

  useEffect(() => {
    savePlainToStorage(LAST_ACTIVE_TAB_KEY, repoRef);
  }, [repoRef]);

  useEffect(() => {
    if (!tabs.find((t) => t.key === repoRef)) {
      navigateBrowser('/');
    }
  }, [repoRef, tabs]);

  const handleRemoveTab = useCallback(
    (tabKey: string) => {
      const prevIndex = tabs.findIndex((t) => t.key === repoRef);
      if (tabKey === repoRef) {
        const newTab =
          prevIndex > 0 ? tabs[prevIndex - 1] : tabs[prevIndex + 1];
        navigateBrowser(newTab.currentUrl);
      }
      setTabs((prev) => prev.filter((t) => t.key !== tabKey));
    },
    [tabs],
  );

  const updateTabNavHistory = useCallback(
    (tabKey: string, history: (prev: NavigationItem[]) => NavigationItem[]) => {
      setTabs((prev) => {
        const tabIndex = prev.findIndex((t) => t.key === tabKey);
        if (tabIndex < 0) {
          return prev;
        }
        const newTab = {
          ...prev[tabIndex],
          navigationHistory: history(prev[tabIndex].navigationHistory),
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
        if (Object.keys(tabs).includes(e.key)) {
          const newTab = tabs[Number(e.key)];
          if (newTab) {
            e.preventDefault();
            navigateBrowser(newTab.currentUrl);
          }
        } else if (e.key === 'w' && repoRef !== 'initial') {
          e.preventDefault();
          e.stopPropagation();
          handleRemoveTab(repoRef);
          return true;
        }
      }
    },
    [tabs, repoRef],
  );
  useKeyboardNavigation(handleKeyEvent);

  const contextValue = useMemo(
    () => ({
      tabs,
      handleAddTab,
      handleRemoveTab,
      updateTabNavHistory,
      updateTabBranch,
    }),
    [tabs, handleAddTab, handleRemoveTab, updateTabNavHistory, updateTabBranch],
  );

  const fetchRepos = useCallback(() => {
    getRepos().then((data) => {
      const list = data?.list?.sort((a, b) => (a.name < b.name ? -1 : 1)) || [];
      setRepositories(list);
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
            {tabs.map((t) => (
              <Tab key={t.key} isActive={t.key === repoRef} tab={t} />
            ))}
          </TabsContext.Provider>
        </RepositoriesContext.Provider>
      </AnalyticsContextProvider>
    </DeviceContextProvider>
  );
}

export default App;
