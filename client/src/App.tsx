import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DeviceContextType } from './context/deviceContext';
import './index.css';
import 'highlight.js/styles/vs2015.css';
import Tab from './Tab';
import { TabsContext } from './context/tabsContext';
import { RepoType, UITabType } from './types/general';
import {
  getJsonFromStorage,
  getPlainFromStorage,
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

function App({ deviceContextValue }: Props) {
  useComponentWillMount(() => initApi(deviceContextValue.apiUrl));

  const [tabs, setTabs] = useState<UITabType[]>([
    {
      key: 'initial',
      name: 'Home',
      repoName: '',
      source: RepoSource.LOCAL,
    },
  ]);
  const [activeTab, setActiveTab] = useState('initial');
  const [repositories, setRepositories] = useState<RepoType[] | undefined>();

  const handleAddTab = useCallback(
    (repoRef: string, repoName: string, name: string, source: RepoSource) => {
      const newTab = {
        key: repoRef,
        name,
        repoName,
        source,
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

  const contextValue = useMemo(
    () => ({
      tabs,
      activeTab,
      handleAddTab,
      handleRemoveTab,
      setActiveTab,
    }),
    [tabs, activeTab, handleAddTab, handleRemoveTab],
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
