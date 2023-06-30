import React, { createContext } from 'react';
import { FilterType, SearchHistoryItem } from '../types/general';

type ContextType = {
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  searchHistory: SearchHistoryItem[];
  setSearchHistory: React.Dispatch<React.SetStateAction<SearchHistoryItem[]>>;
  filters: FilterType[];
  setFilters: React.Dispatch<React.SetStateAction<FilterType[]>>;
  globalRegex: boolean;
  setGlobalRegex: React.Dispatch<React.SetStateAction<boolean>>;
  selectedBranch: string | null;
  setSelectedBranch: React.Dispatch<React.SetStateAction<string | null>>;
};

export const SearchContext = createContext<ContextType>({
  inputValue: '',
  setInputValue: (value) => {},
  searchHistory: [],
  setSearchHistory: (newHistory) => {},
  filters: [],
  setFilters: (f) => {},
  globalRegex: false,
  setGlobalRegex: (b) => {},
  selectedBranch: null,
  setSelectedBranch: () => {},
});
