import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildRepoQuery } from '../../utils';
import { NavigationItem, SearchType, UITabType } from '../../types/general';
import { AppNavigationContext } from '../appNavigationContext';
import { FileModalContext } from '../fileModalContext';
import { TabsContext } from '../tabsContext';

export const AppNavigationProvider = ({
  tab,
  children,
}: {
  tab: UITabType;
  children: JSX.Element | JSX.Element[];
}) => {
  const [forwardNavigation, setForwardNavigation] = useState<NavigationItem[]>(
    [],
  );
  const { closeFileModalOpen, isFileModalOpen, openFileModal } =
    useContext(FileModalContext);
  const { updateTabNavHistory } = useContext(TabsContext);

  const navigatedItem = useMemo(
    () =>
      tab.navigationHistory.length
        ? tab.navigationHistory[tab.navigationHistory.length - 1]
        : undefined,
    [tab.navigationHistory],
  );

  useEffect(() => {
    // open file modal if the app is opened through a URL with modal params
    if (
      navigatedItem?.isInitial &&
      navigatedItem?.pathParams?.modalPath &&
      !isFileModalOpen
    ) {
      openFileModal(
        navigatedItem.pathParams.modalPath,
        navigatedItem.pathParams.modalScrollToLine,
        navigatedItem.pathParams.modalHighlightColor,
      );
    }
  }, [tab.navigationHistory, navigatedItem, isFileModalOpen]);

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

  const saveState = useCallback((navigationItem: NavigationItem) => {
    updateTabNavHistory(tab.key, (prevState) =>
      JSON.stringify(navigationItem) !== JSON.stringify(prevState.slice(-1)[0])
        ? [...prevState, navigationItem]
        : prevState,
    ); // do not duplicate navigation item if called multiple times
    setForwardNavigation([]);
  }, []);

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
      closeFileModalOpen();

      saveState({
        type: 'repo',
        repo,
        path,
        searchType: SearchType.REGEX,
        pathParams,
      });
    },
    [closeFileModalOpen],
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
    updateTabNavHistory(tab.key, (prevState) => {
      setForwardNavigation((prev) => [...prev, prevState.slice(delta)[0]]);
      return prevState.slice(0, delta);
    });
  }, []);

  const navigateForward = useCallback(() => {
    updateTabNavHistory(tab.key, (prevState) => {
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
        navigationHistory: tab.navigationHistory,
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
      {children}
    </AppNavigationContext.Provider>
  );
};
