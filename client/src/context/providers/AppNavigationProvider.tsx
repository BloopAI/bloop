import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildRepoQuery } from '../../utils';
import { NavigationItem, SearchType } from '../../types/general';
import { AppNavigationContext } from '../appNavigationContext';

export const AppNavigationProvider = (prop: {
  value?: string;
  children: JSX.Element | JSX.Element[];
}) => {
  const [navigation, setNavigation] = useState<NavigationItem[]>([]);
  const [forwardNavigation, setForwardNavigation] = useState<NavigationItem[]>(
    [],
  );
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

  const saveState = useCallback(
    (navigationItem: NavigationItem) => {
      setNavigation((prevState) =>
        JSON.stringify(navigationItem) !==
        JSON.stringify(prevState.slice(-1)[0])
          ? [...prevState, navigationItem]
          : prevState,
      ); // do not duplicate navigation item if called multiple times
      setForwardNavigation([]);
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
    },
    [navigateBrowser],
  );

  const navigate = useCallback(
    (
      type: NavigationItem['type'],
      query?: string,
      repo?: string,
      path?: string,
      page?: number,
    ) => {
      saveState({ type, query, repo, path, page });
    },
    [],
  );

  const navigateSearch = useCallback((query: string, page?: number) => {
    saveState({
      type: 'search',
      page,
      query,
    });
  }, []);

  const navigateRepoPath = useCallback(
    (repo: string, path?: string, pathParams?: Record<string, string>) => {
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
    },
    [],
  );

  const navigateConversationResults = useCallback(
    (messageIndex: number, threadId: string) => {
      if (
        navigatedItem?.type !== 'conversation-result' ||
        navigatedItem?.recordId !== messageIndex ||
        navigatedItem?.threadId !== threadId
      ) {
        saveState({
          type: 'conversation-result',
          recordId: messageIndex,
          threadId,
        });
      }
    },
    [navigatedItem],
  );

  const navigateArticleResponse = useCallback(
    (messageIndex: number, threadId: string) => {
      if (
        navigatedItem?.type !== 'article-response' ||
        navigatedItem?.recordId !== messageIndex ||
        navigatedItem?.threadId !== threadId
      ) {
        saveState({
          type: 'article-response',
          recordId: messageIndex,
          threadId,
        });
      }
    },
    [navigatedItem],
  );

  const navigateFullResult = useCallback(
    (repo: string, path: string, pathParams?: Record<string, string>) => {
      saveState({
        type: 'full-result',
        repo,
        path,
        searchType: SearchType.REGEX,
        pathParams,
      });
    },
    [],
  );

  const navigateBack = useCallback((delta: number = -1) => {
    if (!delta) {
      return;
    }
    setNavigation((prevState) => {
      setForwardNavigation((prev) => [...prev, prevState.slice(delta)[0]]);
      return prevState.slice(0, delta);
    });
  }, []);

  const navigateForward = useCallback(() => {
    setNavigation((prevState) => {
      setForwardNavigation((prev) => prev.slice(0, -1));
      return [...prevState, forwardNavigation.slice(-1)[0]];
    });
  }, [forwardNavigation]);

  const navigateHome = useCallback(() => {
    saveState({ type: 'home' });
  }, []);

  return (
    <AppNavigationContext.Provider
      value={{
        navigationHistory: navigation,
        forwardNavigation,
        navigate,
        navigateBack,
        navigatedItem,
        navigateRepoPath,
        navigateFullResult,
        navigateSearch,
        navigateHome,
        navigateForward,
        navigateConversationResults,
        navigateArticleResponse,
        query: query || '',
      }}
    >
      {prop.children}
    </AppNavigationContext.Provider>
  );
};
