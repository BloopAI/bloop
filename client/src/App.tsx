import React, { useCallback, useMemo, useState } from 'react';
import { DeviceContextType } from './context/deviceContext';
import './index.css';
import 'highlight.js/styles/vs2015.css';
import Tab from './Tab';
import { TabsContext } from './context/tabsContext';
import { UITabType } from './types/general';
import { getJsonFromStorage, SEARCH_HISTORY_KEY } from './services/storage';
import { initApi } from './services/api';
import { useComponentWillMount } from './hooks/useComponentWillMount';
import { RepoSource } from './types';

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
      searchHistory: getJsonFromStorage(SEARCH_HISTORY_KEY) || [],
    },
  ]);
  const [activeTab, setActiveTab] = useState('initial');

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

  return (
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
  );
}

export default App;
