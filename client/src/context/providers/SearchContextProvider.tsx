import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { FilterType, SearchHistoryItem, SearchType } from '../../types/general';
import { SearchContext } from '../searchContext';
import useAppNavigation from '../../hooks/useAppNavigation';
import { UIContext } from '../uiContext';
import { AnalyticsContext } from '../analyticsContext';

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
  const [lastQueryTime, setLastQueryTime] = useState(3);
  const [globalRegex, setGlobalRegex] = useState(false);
  const { navigatedItem } = useAppNavigation();
  const { isGithubConnected } = useContext(UIContext);
  const { isAnalyticsAllowed } = useContext(AnalyticsContext);
  const [searchType, setSearchType] = useState(
    isGithubConnected && isAnalyticsAllowed
      ? navigatedItem?.searchType ?? SearchType.NL
      : SearchType.REGEX,
  );

  useEffect(() => {
    setSearchType(
      isGithubConnected && isAnalyticsAllowed
        ? navigatedItem?.searchType ?? SearchType.NL
        : SearchType.REGEX,
    );
  }, [navigatedItem?.searchType, isGithubConnected, isAnalyticsAllowed]);

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
