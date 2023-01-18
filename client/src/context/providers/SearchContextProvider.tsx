import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { FilterType, SearchType } from '../../types/general';
import { getJsonFromStorage, SEARCH_HISTORY_KEY } from '../../services/storage';
import { SearchContext } from '../searchContext';
import useAppNavigation from '../../hooks/useAppNavigation';

type Props = {
  initialSearchHistory?: string[];
};

export const SearchContextProvider = ({
  children,
  initialSearchHistory,
}: PropsWithChildren<Props>) => {
  const [inputValue, setInputValue] = useState('');
  const [filters, setFilters] = useState<FilterType[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>(
    initialSearchHistory || [],
  );
  const [lastQueryTime, setLastQueryTime] = useState(3);
  const [globalRegex, setGlobalRegex] = useState(false);
  const { navigatedItem } = useAppNavigation();
  const [searchType, setSearchType] = useState(
    navigatedItem?.searchType ?? SearchType.NL,
  );

  useEffect(() => {
    setSearchType(navigatedItem?.searchType ?? SearchType.NL);
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
