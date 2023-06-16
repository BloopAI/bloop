import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import {
  FilterType,
  SearchHistoryItem,
  TabHistoryType,
  UITabType,
} from '../../types/general';
import { SearchContext } from '../searchContext';
import {
  getJsonFromStorage,
  saveJsonToStorage,
  TABS_HISTORY_KEY,
} from '../../services/storage';

type Props = {
  tab: UITabType;
};

export const SearchContextProvider = ({
  children,
  tab,
}: PropsWithChildren<Props>) => {
  const [inputValue, setInputValue] = useState('');
  const [filters, setFilters] = useState<FilterType[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(
    (getJsonFromStorage<TabHistoryType[]>(TABS_HISTORY_KEY) || []).find(
      (h) => h.tabKey === tab.key,
    )?.history || [],
  );
  const [globalRegex, setGlobalRegex] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  useEffect(() => {
    const prevHistory = (
      getJsonFromStorage<TabHistoryType[]>(TABS_HISTORY_KEY) || []
    ).filter((h) => h.tabKey !== tab.key);
    const newHistory = [
      ...prevHistory,
      { tabKey: tab.key, history: searchHistory },
    ];
    saveJsonToStorage(TABS_HISTORY_KEY, newHistory);
  }, [searchHistory, tab.key]);

  const searchContextValue = useMemo(
    () => ({
      inputValue,
      setInputValue,
      searchHistory,
      setSearchHistory,
      filters,
      setFilters,
      globalRegex,
      setGlobalRegex,
      selectedBranch,
      setSelectedBranch,
    }),
    [inputValue, filters, searchHistory, globalRegex, selectedBranch],
  );
  return (
    <SearchContext.Provider value={searchContextValue}>
      {children}
    </SearchContext.Provider>
  );
};
