import { createContext, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildRepoQuery, generateUniqueId } from '../utils';
import { SearchType } from '../types/general';

interface NavigationItem {
  type: 'search' | 'repo' | 'full-result' | 'home';
  query?: string;
  repo?: string;
  path?: string;
  page?: number;
  loaded?: boolean;
  searchType?: SearchType;
  pathParams?: Record<string, string>;
  threadId?: string;
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
  query: string;
};

const AppNavigationContext = createContext<ContextType>({
  navigationHistory: [],
  navigate: (type) => {},
  navigateBack: () => {},
  navigateHome: () => {},
  navigateRepoPath: (repo, path) => {},
  navigateSearch: (query, page) => {},
  navigateFullResult: (repo, path) => {},
  query: '',
});

export const AppNavigationProvider = (prop: {
  value?: string;
  children: JSX.Element | JSX.Element[];
}) => {
  const [navigation, setNavigation] = useState<NavigationItem[]>([]);
  const navigateBrowser = useNavigate();

  const navigatedItem = useMemo(
    () => (navigation.length ? navigation[navigation.length - 1] : undefined),
    [navigation],
  );

  const buildQuery = (navigationItem: NavigationItem) => {
    const { query, path, repo, type } = navigationItem;
    switch (type) {
      case 'repo':
      case 'full-result':
        return buildRepoQuery(repo, path);
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
    if (navigationItem.type === 'home') {
      navigateBrowser('/');
      return;
    }
    navigateBrowser(
      '/search' +
        (navigationItem.pathParams
          ? '?' + new URLSearchParams(navigationItem.pathParams).toString()
          : '') +
        '#' +
        buildQuery(navigationItem),
    );
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

  const navigateSearch = (
    query: string,
    searchType: SearchType,
    page?: number,
  ) => {
    saveState({
      type: 'search',
      page,
      query,
      searchType,
      ...(searchType === SearchType.NL ? { threadId: generateUniqueId() } : {}),
    });
  };

  const navigateRepoPath = (
    repo: string,
    path?: string,
    pathParams?: Record<string, string>,
  ) => {
    /*
     * Handling root path for navigation
     * */
    if (path === '/') {
      path = undefined;
    }

    saveState({
      type: 'repo',
      repo,
      path,
      searchType: SearchType.REGEX,
      pathParams,
    });
  };

  const navigateFullResult = (
    repo: string,
    path: string,
    pathParams?: Record<string, string>,
  ) => {
    saveState({
      type: 'full-result',
      repo,
      path,
      searchType: SearchType.REGEX,
      pathParams,
    });
  };

  const navigateBack = () => {
    setNavigation((prevState) => {
      return prevState.slice(0, -1);
    });
  };

  const navigateHome = () => {
    saveState({ type: 'home' });
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
        navigateHome,
        query: query || '',
      }}
    >
      {prop.children}
    </AppNavigationContext.Provider>
  );
};

const useAppNavigation = () => useContext(AppNavigationContext) as ContextType;

export default useAppNavigation;
