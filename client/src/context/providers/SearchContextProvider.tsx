import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { FilterType, SearchType } from '../../types/general';
import { getJsonFromStorage, SEARCH_HISTORY_KEY } from '../../services/storage';
import { SearchContext } from '../searchContext';
import useAppNavigation from '../../hooks/useAppNavigation';

export const SearchContextProvider = ({ children }: PropsWithChildren) => {
  const [inputValue, setInputValue] = useState('');
  const [filters, setFilters] = useState<FilterType[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>(
    getJsonFromStorage(SEARCH_HISTORY_KEY) || [],
  );
  const [lastQueryTime, setLastQueryTime] = useState(3);
  const [globalRegex, setGlobalRegex] = useState(false);
  const { navigatedItem } = useAppNavigation();
  const [searchType, setSearchType] = useState(
    navigatedItem?.searchType ?? SearchType.REGEX,
  );

  useEffect(() => {
    setSearchType(navigatedItem?.searchType ?? SearchType.REGEX);
  }, [navigatedItem?.searchType]);

  const searchContextValue = useMemo(
    () => ({
      inputValue,
      setInputValue,
      searchHistory,
      setSearchHistory,
      filters,
      setFilters,
      lastQueryTime,
      setLastQueryTime,
      globalRegex,
      setGlobalRegex,
      searchType,
      setSearchType,
    }),
    [
      inputValue,
      filters,
      searchHistory,
      lastQueryTime,
      globalRegex,
      searchType,
    ],
  );
  return (
    <SearchContext.Provider value={searchContextValue}>
      {children}
    </SearchContext.Provider>
  );
};
