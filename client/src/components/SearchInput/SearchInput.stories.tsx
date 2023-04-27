import React, { useMemo, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SearchContext } from '../../context/searchContext';
import { mockFiltersInitial } from '../../mocks';
import { SearchHistoryItem } from '../../types/general';
import SearchInput from './index';
import '../../index.css';

export default {
  title: 'components/SearchInput',
  component: SearchInput,
};

export const Default = () => {
  const [inputValue, setInputValue] = useState('');
  const [filters, setFilters] = useState(mockFiltersInitial);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([
    'org:rust-lang cobra-ats error:no apples',
    'error:no apples',
    'error:no items',
  ]);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [globalRegex, setGlobalRegex] = useState(false);
  const searchContextValue = useMemo(
    () => ({
      inputValue,
      setInputValue,
      searchHistory,
      setSearchHistory,
      filters,
      setFilters,
      searchSubmitted,
      setSearchSubmitted,
      globalRegex,
      setGlobalRegex,
    }),
    [inputValue],
  );
  return (
    <MemoryRouter initialEntries={['']}>
      <SearchContext.Provider value={searchContextValue}>
        <div className="bg-gray-900 relative">
          <SearchInput />
        </div>
      </SearchContext.Provider>
    </MemoryRouter>
  );
};

export const MixedSuggestions = () => {
  const [inputValue, setInputValue] = useState('');
  const [filters, setFilters] = useState(mockFiltersInitial);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([
    'org:rust-lang cobra-ats error:no apples',
    'error:no apples',
    'error:no items',
  ]);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [globalRegex, setGlobalRegex] = useState(false);
  const searchContextValue = useMemo(
    () => ({
      inputValue,
      setInputValue,
      searchHistory,
      setSearchHistory,
      filters,
      setFilters,
      searchSubmitted,
      setSearchSubmitted,
      globalRegex,
      setGlobalRegex,
    }),
    [inputValue],
  );
  return (
    <MemoryRouter initialEntries={['']}>
      <SearchContext.Provider value={searchContextValue}>
        <div className="bg-gray-900 relative">
          <SearchInput />
        </div>
      </SearchContext.Provider>
    </MemoryRouter>
  );
};
