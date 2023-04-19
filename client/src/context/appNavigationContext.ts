import { createContext } from 'react';
import { NavigationItem, SearchType } from '../types/general';

type ContextType = {
  navigationHistory: NavigationItem[];
  forwardNavigation: NavigationItem[];
  navigatedItem?: NavigationItem;
  navigate: (
    type: NavigationItem['type'],
    query?: string,
    repo?: string,
    path?: string,
    page?: number,
  ) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  navigateHome: () => void;
  navigateRepoPath: (
    repo: string,
    path?: string,
    pathParams?: Record<string, string>,
  ) => void;
  navigateSearch: (
    query: string,
    searchType: SearchType,
    page?: number,
  ) => void;
  navigateFullResult: (
    repo: string,
    path: string,
    pathParams?: Record<string, string>,
  ) => void;
  navigateConversationResults: (messageIndex: number) => void;
  query: string;
};

export const AppNavigationContext = createContext<ContextType>({
  navigationHistory: [],
  forwardNavigation: [],
  navigate: (type) => {},
  navigateBack: () => {},
  navigateForward: () => {},
  navigateHome: () => {},
  navigateRepoPath: (repo, path) => {},
  navigateSearch: (query, page) => {},
  navigateFullResult: (repo, path) => {},
  navigateConversationResults: (recordId) => {},
  query: '',
});
