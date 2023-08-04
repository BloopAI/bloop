import { createContext } from 'react';
import { NavigationItem } from '../types/general';

type ContextType = {
  navigationHistory: NavigationItem[];
  forwardNavigation: NavigationItem[];
  navigatedItem?: NavigationItem;
  navigateBack: (delta?: number | 'auto') => void;
  navigateForward: (delta?: number | 'auto') => void;
  navigateRepoPath: (
    repo: string,
    path?: string,
    pathParams?: Record<string, string>,
  ) => void;
  navigateSearch: (query: string, page?: number) => void;
  navigateFullResult: (
    path: string,
    pathParams?: Record<string, string>,
    messageIndex?: number,
    searchId?: string,
  ) => void;
  navigateArticleResponse: (messageIndex: number, searchId: string) => void;
  updateScrollToIndex: (lines: string) => void;
  query: string;
};

export const AppNavigationContext = createContext<ContextType>({
  navigationHistory: [],
  forwardNavigation: [],
  navigateBack: () => {},
  navigateForward: () => {},
  navigateRepoPath: (repo, path) => {},
  navigateSearch: (query, page) => {},
  navigateFullResult: () => {},
  navigateArticleResponse: (recordId, searchId) => {},
  updateScrollToIndex: (lines) => {},
  query: '',
});
