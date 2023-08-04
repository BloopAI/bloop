import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildRepoQuery } from '../../utils';
import { NavigationItem, SearchType, UITabType } from '../../types/general';
import { AppNavigationContext } from '../appNavigationContext';
import { FileModalContext } from '../fileModalContext';
import { TabsContext } from '../tabsContext';
import { findElementInCurrentTab } from '../../utils/domUtils';

export const AppNavigationProvider = ({
  tab,
  children,
}: {
  tab: UITabType;
  children: JSX.Element | JSX.Element[];
}) => {
  const navigateBrowser = useNavigate();
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
        true,
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

  const navigateSearch = useCallback((query: string, page?: number) => {
    saveState({
      type: 'search',
      page,
      query,
    });
    navigateBrowser(
      `search?${new URLSearchParams(
        page !== undefined ? { query, page: page.toString() } : { query },
      ).toString()}`,
    );
  }, []);

  const navigateRepoPath = useCallback(
    (repo: string, path?: string, pathParams?: Record<string, string>) => {
      /*
       * Handling root path for navigation
       * */
      if (path === '/') {
        path = undefined;
      }
      closeFileModalOpen(true);

      saveState({
        type: 'repo',
        repo,
        path,
        searchType: SearchType.REGEX,
        pathParams,
      });
      navigateBrowser(
        `/${encodeURIComponent(repo)}/${encodeURIComponent(
          tab.branch || 'all',
        )}/repo${
          path
            ? '?' +
              new URLSearchParams({
                path: path,
                ...pathParams,
              }).toString()
            : ''
        }`,
      );
    },
    [closeFileModalOpen],
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
      navigateBrowser(
        `/${encodeURIComponent(tab.key)}/${encodeURIComponent(
          tab.branch || 'all',
        )}/article-response?${new URLSearchParams({
          threadId: threadId?.toString() || '',
          recordId: messageIndex?.toString() || '',
        }).toString()}`,
      );
    },
    [navigatedItem],
  );

  const navigateFullResult = useCallback(
    (
      path: string,
      pathParams?: Record<string, string>,
      messageIndex?: number,
      threadId?: string,
    ) => {
      closeFileModalOpen(true);
      saveState({
        type: 'full-result',
        repo: tab.repoName,
        path,
        searchType: SearchType.REGEX,
        pathParams,
        recordId: messageIndex,
        threadId,
      });
      navigateBrowser(
        `/${encodeURIComponent(tab.key)}/${encodeURIComponent(
          tab.branch || 'all',
        )}/full-result${
          path
            ? '?' +
              new URLSearchParams({
                path: path,
                ...pathParams,
              }).toString()
            : ''
        }`,
      );
    },
    [tab.repoName],
  );

  const updateScrollToIndex = useCallback((lines: string) => {
    updateTabNavHistory(tab.key, (prevState) => {
      const newItem = prevState[prevState.length - 1];
      if (!newItem) {
        return prevState;
      }
      newItem.pathParams = { ...(newItem.pathParams || {}) };
      if (newItem.pathParams.scrollToLine === lines) {
        const [startLine, endLine] = lines.split('_');
        // suboptimal way to scroll to the same line as in path params when the user scrolled away from it
        findElementInCurrentTab(
          `[data-line-number="${startLine}"]`,
        )?.scrollIntoView({
          behavior: 'smooth',
          block: Number(endLine) - Number(startLine) < 8 ? 'center' : 'start',
        });
      }
      newItem.pathParams.scrollToLine = lines;
      return [...prevState.slice(0, -1), newItem];
    });
  }, []);

  const navigateBack = useCallback(
    (delta: number | 'auto' = -1) => {
      if (!delta) {
        return;
      }
      closeFileModalOpen(true);
      updateTabNavHistory(tab.key, (prevState) => {
        if (!prevState.length) {
          return prevState;
        }
        let index = delta as number;
        if (delta === 'auto') {
          const currentItem = prevState[prevState.length - 1];
          const lastIndex = prevState.findLastIndex(
            (item) =>
              item.type !== currentItem.type ||
              item.path !== currentItem.path ||
              item.recordId !== currentItem.recordId ||
              item.threadId !== currentItem.threadId,
          );
          if (lastIndex > -1) {
            index = -(prevState.length - 1 - lastIndex);
          } else {
            index = -1;
          }
        }
        setForwardNavigation((prev) => [...prevState.slice(index), ...prev]);
        return prevState.slice(0, index);
      });
    },
    [closeFileModalOpen],
  );

  const navigateForward = useCallback(
    (delta: number | 'auto' = 1) => {
      if (!delta) {
        return;
      }
      closeFileModalOpen(true);
      updateTabNavHistory(tab.key, (prevState) => {
        let index = delta as number;
        if (delta === 'auto') {
          const currentItem = prevState[prevState.length - 1];
          const lastIndex = forwardNavigation.findIndex(
            (item) =>
              item.type !== currentItem.type ||
              item.path !== currentItem.path ||
              item.recordId !== currentItem.recordId ||
              item.threadId !== currentItem.threadId,
          );
          if (lastIndex > 0) {
            index = lastIndex;
          } else {
            index = 1;
          }
        }
        setForwardNavigation((prev) => prev.slice(index));
        return [...prevState, ...forwardNavigation.slice(0, index)];
      });
    },
    [forwardNavigation, closeFileModalOpen],
  );

  return (
    <AppNavigationContext.Provider
      value={{
        navigationHistory: tab.navigationHistory,
        forwardNavigation,
        navigateBack,
        navigatedItem,
        navigateRepoPath,
        navigateFullResult,
        navigateSearch,
        navigateForward,
        navigateArticleResponse,
        updateScrollToIndex,
        query: query || '',
      }}
    >
      {children}
    </AppNavigationContext.Provider>
  );
};
