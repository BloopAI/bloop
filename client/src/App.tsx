import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Location, useLocation, useNavigate } from 'react-router-dom';
import { DeviceContextType } from './context/deviceContext';
import './index.css';
import 'highlight.js/styles/vs2015.css';
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

type Props = {
  deviceContextValue: DeviceContextType;
};

const buildURLPart = (navItem: NavigationItem) => {
  switch (navItem.type) {
    case 'search':
      return `search${
        navItem.pathParams
          ? '?' + new URLSearchParams(navItem.pathParams).toString()
          : ''
      }#${navItem.query}`;
    case 'repo':
      return `repo${
        navItem.path
          ? '?' +
            new URLSearchParams({
              path: navItem.path,
              ...navItem.pathParams,
            }).toString()
          : ''
      }`;
    case 'full-result':
      return `full-result?${new URLSearchParams({
        path: navItem.path || '',
        ...navItem.pathParams,
      }).toString()}`;
    case 'conversation-result':
      return `conversation-result?${new URLSearchParams({
        threadId: navItem.threadId?.toString() || '',
        recordId: navItem.recordId?.toString() || '',
      }).toString()}`;
    case 'article-response':
      return `article-response?${new URLSearchParams({
        threadId: navItem.threadId?.toString() || '',
        recordId: navItem.recordId?.toString() || '',
      }).toString()}`;
    default:
      return '';
  }
};

const getNavItemFromURL = (location: Location, repoName: string) => {
  const type = location.pathname.split('/')[2];
  const possibleTypes = [
    'search',
    'repo',
    'full-result',
    'home',
    'conversation-result',
    'article-response',
  ];
  if (!possibleTypes.includes(type)) {
    return undefined;
  }
  const navItem: NavigationItem = {
    type: type as NavigationItem['type'],
    searchType: 0,
    repo: repoName,
  };
  navItem.query = location.hash.slice(1);
  navItem.path = new URLSearchParams(location.search).get('path') || undefined;
  navItem.pathParams = {};
  const modalPath = new URLSearchParams(location.search).get('modalPath');
  if (modalPath) {
    navItem.pathParams.modalPath = modalPath;
  }
  const modalScrollToLine = new URLSearchParams(location.search).get(
    'modalScrollToLine',
  );
  if (modalScrollToLine) {
    navItem.pathParams.modalScrollToLine = modalScrollToLine;
  }
  const modalHighlightColor = new URLSearchParams(location.search).get(
    'modalHighlightColor',
  );
  if (modalHighlightColor) {
    navItem.pathParams.highlightColor = modalHighlightColor;
  }
  const highlightColor = new URLSearchParams(location.search).get(
    'highlightColor',
  );
  if (highlightColor) {
    navItem.pathParams.highlightColor = highlightColor;
  }
  const scrollToLine = new URLSearchParams(location.search).get('scrollToLine');
  if (scrollToLine) {
    navItem.pathParams.scrollToLine = scrollToLine;
  }
  const threadId = new URLSearchParams(location.search).get('threadId');
  if (threadId) {
    navItem.threadId = threadId;
  }
  const recordId = new URLSearchParams(location.search).get('recordId');
  if (recordId) {
    navItem.recordId = Number(recordId);
  }
  return [navItem];
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
    if (tab) {
      if (activeTab === 'initial') {
        navigate('/');
        return;
      }
      const lastNav = tab.navigationHistory[tab.navigationHistory.length - 1];
      console.log('lastNav', lastNav, buildURLPart(lastNav));
      navigate(
        `/${encodeURIComponent(activeTab)}/${
          lastNav ? buildURLPart(lastNav) : ''
        }`,
      );
    }
  }, [activeTab, tabs]);

  const handleAddTab = useCallback(
    (
      repoRef: string,
      repoName: string,
      name: string,
      source: RepoSource,
      navHistory?: NavigationItem[],
    ) => {
      const newTab = {
        key: repoRef,
        name,
        repoName,
        source,
        navigationHistory: navHistory || [],
      };
      setTabs((prev) => {
        const existing = prev.find((t) => t.key === newTab.key);
        if (existing) {
          setActiveTab(existing.key);
          return prev;
        }
        return [...prev, newTab];
      });
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
        handleAddTab(
          repo.ref,
          repo.provider === RepoProvider.GitHub ? repo.ref : repo.name,
          repo.name,
          repo.provider === RepoProvider.GitHub
            ? RepoSource.GH
            : RepoSource.LOCAL,
          getNavItemFromURL(location, repo.name),
        );
        setLoading(false);
      }
    }
  }, [repositories, isLoading, repositories]);

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

  const contextValue = useMemo(
    () => ({
      tabs,
      activeTab,
      handleAddTab,
      handleRemoveTab,
      setActiveTab,
      updateTabNavHistory,
    }),
    [tabs, activeTab, handleAddTab, handleRemoveTab, updateTabNavHistory],
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
    <AnalyticsContextProvider
      forceAnalytics={deviceContextValue.forceAnalytics}
      isSelfServe={deviceContextValue.isSelfServe}
      envConfig={deviceContextValue.envConfig}
    >
      <RepositoriesContext.Provider value={reposContextValue}>
        <TabsContext.Provider value={contextValue}>
          {tabs.map((t) => (
            <Tab
              key={t.key}
              deviceContextValue={deviceContextValue}
              isActive={t.key === activeTab}
              tab={t}
            />
          ))}
        </TabsContext.Provider>
      </RepositoriesContext.Provider>
    </AnalyticsContextProvider>
  );
}

export default App;
