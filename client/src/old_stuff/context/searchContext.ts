import React, { createContext } from 'react';
import { FilterType } from '../types/general';

export const SearchContext = {
  InputValue: createContext<{
    inputValue: string;
    setInputValue: React.Dispatch<React.SetStateAction<string>>;
  }>({
    inputValue: '',
    setInputValue: () => {},
  }),
  Filters: createContext<{
    filters: FilterType[];
    setFilters: React.Dispatch<React.SetStateAction<FilterType[]>>;
  }>({
    filters: [],
    setFilters: (f) => {},
  }),
  RegexEnabled: createContext({
    globalRegex: false,
    setGlobalRegex: (b: boolean) => {},
  }),
  SelectedBranch: createContext<{
    selectedBranch: string | null;
    setSelectedBranch: React.Dispatch<React.SetStateAction<string | null>>;
  }>({
    selectedBranch: null,
    setSelectedBranch: () => {},
  }),
};
