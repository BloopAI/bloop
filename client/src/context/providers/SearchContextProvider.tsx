import React, { PropsWithChildren, useMemo, useState } from 'react';
import { FilterType, SearchHistoryItem } from '../../types/general';
import { SearchContext } from '../searchContext';

type Props = {
  initialSearchHistory?: string[];
};

export const SearchContextProvider = ({
  children,
  initialSearchHistory,
}: PropsWithChildren<Props>) => {
  const [inputValue, setInputValue] = useState('');
  const [filters, setFilters] = useState<FilterType[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(
    initialSearchHistory || [],
  );
  const [globalRegex, setGlobalRegex] = useState(false);

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
    }),
    [inputValue, filters, searchHistory, globalRegex],
  );
  return (
    <SearchContext.Provider value={searchContextValue}>
      {children}
    </SearchContext.Provider>
  );
};
