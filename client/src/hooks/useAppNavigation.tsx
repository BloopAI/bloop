import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { usePersistentState } from './usePersistentState';

interface NavigationItem {
  type: 'search' | 'search-file' | 'repo' | 'full-result';
  query?: string;
  repo?: string;
  path?: string;
  page?: number;
  loaded?: boolean;
}

type ContextType = {
  navigationHistory: NavigationItem[];
  navigatedItem?: NavigationItem;
  navigate: (
    type: NavigationItem['type'],
    query?: string,
    repo?: string,
    path?: string,
    page?: number,
  ) => void;
  navigateBack: () => void;
  navigateRepoPath: (repo: string, path?: string) => void;
  navigateSearch: (query: string, page?: number) => void;
  navigateFullResult: (repo: string, path: string) => void;
  navigateSearchFile: (repo: string, path: string) => void;
  query: string;
};

const AppNavigationContext = createContext<ContextType>({
  navigationHistory: [],
  navigate: (type) => {},
  navigateBack: () => {},
  navigateRepoPath: (repo, path) => {},
  navigateSearch: (query, page) => {},
  navigateFullResult: (repo, path) => {},
  navigateSearchFile: (repo, path) => {},
  query: '',
});

export const AppNavigationProvider = (prop: {
  value?: string;
  children: JSX.Element | JSX.Element[];
}) => {
  const [navigation, setNavigation] = usePersistentState<NavigationItem[]>(
    [],
    'navigation',
  );
  const navigateBrowser = useNavigate();

  const getLastItem = () => {
    return navigation[navigation.length - 1];
  };

  const navigatedItem = useMemo(
    () => (navigation.length ? navigation[navigation.length - 1] : undefined),
    [navigation],
  );

  const buildQuery = (navigationItem: NavigationItem) => {
    const { query, path, repo, type } = navigationItem;
    switch (type) {
      case 'repo':
      case 'full-result':
      case 'search-file':
        return `open:true repo:${repo} ${path ? `path:${path}` : ''}`;
      case 'search':
        return query;
      default:
        return '';
    }
  };

  const query = useMemo(() => {
    if (!navigatedItem) {
      return '';
    }
    return buildQuery(navigatedItem);
  }, [navigatedItem]);

  const saveState = (navigationItem: NavigationItem) => {
    setNavigation((prevState) => [...prevState, navigationItem]);
    navigateBrowser('/search#' + buildQuery(navigationItem));
  };

  const navigate = (
    type: NavigationItem['type'],
    query?: string,
    repo?: string,
    path?: string,
    page?: number,
  ) => {
    saveState({ type, query, repo, path, page });
  };

  const navigateSearch = (query: string, page?: number) => {
    saveState({ type: 'search', page, query: query });
  };

  const navigateSearchFile = useCallback(
    (repo: string, path: string) => {
      /*
       * We're replacing previous item in navigation history
       * to avoid back navigation through file modals
       * */
      setNavigation((prevState) => {
        const newState = [...prevState];

        if (prevState[prevState.length - 1].type === 'search-file') {
          newState.pop();
        }
        return [...newState, { type: 'search-file', repo, path }];
      });
    },
    [navigation],
  );

  const navigateRepoPath = (repo: string, path?: string) => {
    /*
     * Handling root path for navigation
     * */
    if (path === '/') {
      path = undefined;
    }

    saveState({ type: 'repo', repo, path });
  };

  const navigateFullResult = (repo: string, path: string) => {
    saveState({ type: 'full-result', repo, path });
  };

  const navigateBack = () => {
    setNavigation((prevState) => {
      return prevState.slice(0, -1);
    });
  };

  return (
    <AppNavigationContext.Provider
      value={{
        navigationHistory: navigation,
        navigate,
        navigateBack,
        navigatedItem,
        navigateRepoPath,
        navigateFullResult,
        navigateSearch,
        navigateSearchFile,
        query: query || '',
      }}
    >
      {prop.children}
    </AppNavigationContext.Provider>
  );
};

const useAppNavigation = () => useContext(AppNavigationContext) as ContextType;

export default useAppNavigation;
