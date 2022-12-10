import React, { createContext } from 'react';
import { FilterType } from '../types/general';

type ContextType = {
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  searchHistory: string[];
  setSearchHistory: React.Dispatch<React.SetStateAction<string[]>>;
  filters: FilterType[];
  setFilters: React.Dispatch<React.SetStateAction<FilterType[]>>;
  lastQueryTime: number;
  setLastQueryTime: (v: number) => void;
  globalRegex: boolean;
  setGlobalRegex: React.Dispatch<React.SetStateAction<boolean>>;
};

export const SearchContext = createContext<ContextType>({
  inputValue: '',
  setInputValue: (value) => {},
  searchHistory: [],
  setSearchHistory: (newHistory) => {},
  filters: [],
  setFilters: (f) => {},
  lastQueryTime: 3,
  setLastQueryTime: (n) => {},
  globalRegex: false,
  setGlobalRegex: (b) => {},
});
