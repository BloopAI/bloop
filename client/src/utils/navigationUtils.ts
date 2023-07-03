import { Location } from 'react-router-dom';
import { NavigationItem } from '../types/general';

export const buildURLPart = (navItem: NavigationItem) => {
  switch (navItem?.type) {
    case 'search':
      return `search${
        navItem.pathParams
          ? '?' + new URLSearchParams(navItem.pathParams).toString()
          : ''
      }#${navItem.query}`;
    case 'repo':
      return `repo${
        navItem.path
          ? '?' +
            new URLSearchParams({
              path: navItem.path,
              ...navItem.pathParams,
            }).toString()
          : ''
      }`;
    case 'full-result':
      return `full-result?${new URLSearchParams({
        path: navItem.path || '',
        ...navItem.pathParams,
      }).toString()}`;
    case 'conversation-result':
      return `conversation-result?${new URLSearchParams({
        threadId: navItem.threadId?.toString() || '',
        recordId: navItem.recordId?.toString() || '',
      }).toString()}`;
    case 'article-response':
      return `article-response?${new URLSearchParams({
        threadId: navItem.threadId?.toString() || '',
        recordId: navItem.recordId?.toString() || '',
      }).toString()}`;
    default:
      return '';
  }
};

export const getNavItemFromURL = (location: Location, repoName: string) => {
  const type = location.pathname.split('/')[2];
  const possibleTypes = [
    'search',
    'repo',
    'full-result',
    'home',
    'conversation-result',
    'article-response',
  ];
  if (!possibleTypes.includes(type)) {
    return undefined;
  }
  const navItem: NavigationItem = {
    type: type as NavigationItem['type'],
    searchType: 0,
    repo: repoName,
  };
  navItem.query = location.hash.slice(1);
  navItem.path = new URLSearchParams(location.search).get('path') || undefined;
  navItem.pathParams = {};
  const modalPath = new URLSearchParams(location.search).get('modalPath');
  if (modalPath) {
    navItem.pathParams.modalPath = modalPath;
  }
  const modalScrollToLine = new URLSearchParams(location.search).get(
    'modalScrollToLine',
  );
  if (modalScrollToLine) {
    navItem.pathParams.modalScrollToLine = modalScrollToLine;
  }
  const modalHighlightColor = new URLSearchParams(location.search).get(
    'modalHighlightColor',
  );
  if (modalHighlightColor) {
    navItem.pathParams.highlightColor = modalHighlightColor;
  }
  const highlightColor = new URLSearchParams(location.search).get(
    'highlightColor',
  );
  if (highlightColor) {
    navItem.pathParams.highlightColor = highlightColor;
  }
  const scrollToLine = new URLSearchParams(location.search).get('scrollToLine');
  if (scrollToLine) {
    navItem.pathParams.scrollToLine = scrollToLine;
  }
  const threadId = new URLSearchParams(location.search).get('threadId');
  if (threadId) {
    navItem.threadId = threadId;
  }
  const recordId = new URLSearchParams(location.search).get('recordId');
  if (recordId) {
    navItem.recordId = Number(recordId);
  }
  return [navItem];
};
