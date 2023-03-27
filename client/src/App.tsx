import React, { useCallback, useMemo, useState } from 'react';
import { DeviceContextType } from './context/deviceContext';
import './index.css';
import './circleProgress.css';
import 'highlight.js/styles/vs2015.css';
import Tab from './Tab';
import { TabsContext } from './context/tabsContext';
import { UITabType } from './types/general';
import { getJsonFromStorage, SEARCH_HISTORY_KEY } from './services/storage';
import { initApi } from './services/api';
import { useComponentWillMount } from './hooks/useComponentWillMount';
import useKeyboardNavigation from './hooks/useKeyboardNavigation';
import { generateUniqueId } from './utils';

type Props = {
  deviceContextValue: DeviceContextType;
};

function App({ deviceContextValue }: Props) {
  useComponentWillMount(() => initApi(deviceContextValue.apiUrl));

  const [tabs, setTabs] = useState<UITabType[]>([
    {
      key: 'initial',
      name: 'Untitled search',
      searchHistory: getJsonFromStorage(SEARCH_HISTORY_KEY) || [],
    },
  ]);
  const [activeTab, setActiveTab] = useState('initial');

  const handleAddTab = useCallback(() => {
    const newTab = {
      key: generateUniqueId(),
      name: 'Home',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTab(newTab.key);
  }, []);

  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if (e.key === 't' && (e.metaKey || e.ctrlKey)) {
      e.stopPropagation();
      e.preventDefault();
      handleAddTab();
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent);

  const updateCurrentTabName = useCallback(
    (newName: string) => {
      setTabs((prev) => {
        const newTabs = [...prev];
        const tabToUpdate = newTabs.findIndex((t) => t.key === activeTab);
        newTabs[tabToUpdate] = { ...newTabs[tabToUpdate], name: newName };
        return newTabs;
      });
    },
    [activeTab],
  );

  const handleRemoveTab = useCallback(
    (tabKey: string) => {
      setActiveTab((prev) => {
        const prevIndex = tabs.findIndex((t) => t.key === prev);
        if (tabKey === prev && tabs.findIndex((t) => t.key === tabKey) !== 0) {
          return tabs[prevIndex - 1].key;
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
      updateCurrentTabName,
    }),
    [tabs, activeTab, handleAddTab, handleRemoveTab, updateCurrentTabName],
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
