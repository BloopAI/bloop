import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import { SearchContext } from '../context/searchContext';
import { useSearch } from '../hooks/useSearch';
import {
  DirectorySearchResponse,
  GeneralSearchResponse,
  SearchResponse,
} from '../types/api';
import PageTemplate from '../components/PageTemplate';
import ErrorFallback from '../components/ErrorFallback';
import useAppNavigation from '../hooks/useAppNavigation';
import { buildRepoQuery } from '../utils';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import { UITabType } from '../types/general';
import RepositoryPage from './Repository';
import ResultsPage from './Results';
import ViewResult from './ResultFull';
import NoResults from './Results/NoResults';
import HomePage from './Home';
import Onboarding from './Onboarding';
import ConversationResult from './ConversationResult';

const mockQuerySuggestions = [
  'repo:cobra-ats  error:“no apples”',
  'error:“no apples”',
  'no apples',
  'repo:cobra-ats apples',
  'lang:tsx apples',
];

type RenderPage =
  | 'results'
  | 'repo'
  | 'full-result'
  | 'nl-result'
  | 'no-results'
  | 'home'
  | 'conversation-result';

let prevRenderPage: RenderPage;

const ContentContainer = ({ tab }: { tab: UITabType }) => {
  const { setInputValue, globalRegex, selectedBranch } =
    useContext(SearchContext);
  const { searchQuery, data, loading } = useSearch<SearchResponse>();

  const { navigatedItem, query, navigateBack, navigateRepoPath } =
    useAppNavigation();

  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if (
      e.key === 'Escape' &&
      document.activeElement?.tagName !== 'INPUT' &&
      !document.getElementsByClassName('modal-or-sidebar').length
    ) {
      e.stopPropagation();
      e.preventDefault();
      navigateBack();
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent);

  useEffect(() => {
    setInputValue('');
  }, []);

  useEffect(() => {
    if (!navigatedItem) {
      if (tab.key !== 'initial') {
        navigateRepoPath(tab.repoName);
      }
      return;
    }

    setInputValue(
      query
        .replace(/repo:.*?\s/, '')
        .replace('open:true', '')
        .trim(),
    );

    switch (navigatedItem.type) {
      case 'repo':
      case 'full-result':
        searchQuery(
          buildRepoQuery(
            navigatedItem.repo,
            navigatedItem.path,
            selectedBranch,
          ),
        );
        break;
      case 'home':
      case 'conversation-result':
        break;
      default:
        const search = navigatedItem.query!.includes(`repo:${tab.name}`)
          ? navigatedItem.query!
          : `${navigatedItem.query} repo:${tab.name}`;
        searchQuery(search, navigatedItem.page, globalRegex);
    }
  }, [navigatedItem, tab.key, tab.name, selectedBranch]);

  const getRenderPage = useCallback(() => {
    let renderPage: RenderPage;
    if (tab.key === 'initial') {
      return 'home';
    }
    if (navigatedItem?.type === 'conversation-result') {
      return 'conversation-result';
    }
    if (navigatedItem?.type === 'full-result') {
      return 'full-result';
    }
    if (!data?.data?.[0] && !loading) {
      return 'no-results';
    }
    if (loading && prevRenderPage && navigatedItem?.type === 'repo') {
      return prevRenderPage;
    }
    const resultType = data?.data?.[0]?.kind;
    switch (resultType) {
      case 'dir':
        renderPage = 'repo';
        break;
      case 'file':
        renderPage = 'full-result';
        break;
      default:
        renderPage = 'results';
    }
    prevRenderPage = renderPage;
    return renderPage;
  }, [navigatedItem, data, loading, tab.key]);

  const renderPage = useMemo(
    () => getRenderPage(),
    [data, loading, navigatedItem, query, navigatedItem?.threadId],
  );

  const renderedPage = useMemo(() => {
    switch (renderPage) {
      case 'results':
        return (
          <ResultsPage
            resultsData={data as GeneralSearchResponse}
            loading={loading}
          />
        );
      case 'no-results':
        return (
          <NoResults
            suggestions={mockQuerySuggestions}
            isRepo={navigatedItem?.type === 'repo' && !navigatedItem?.path}
            isFolder={!!navigatedItem?.path}
            repo={
              navigatedItem?.type === 'repo' ? navigatedItem?.repo : undefined
            }
            refetchRepo={() =>
              navigatedItem?.repo
                ? searchQuery(buildRepoQuery(navigatedItem?.repo))
                : {}
            }
          />
        );
      case 'repo':
        return (
          <RepositoryPage repositoryData={data as DirectorySearchResponse} />
        );
      case 'full-result':
        return <ViewResult data={data} isLoading={loading} />;
      case 'conversation-result':
        return (
          <ConversationResult
            recordId={navigatedItem?.recordId!}
            threadId={navigatedItem?.threadId!}
          />
        );
      default:
        return <HomePage />;
    }
  }, [
    data,
    loading,
    navigatedItem,
    query,
    navigatedItem?.threadId,
    renderPage,
  ]);

  return (
    <>
      <Onboarding />
      <PageTemplate
        withSearchBar={renderPage !== 'home'}
        renderPage={renderPage}
      >
        {renderedPage}
      </PageTemplate>
    </>
  );
};

export default Sentry.withErrorBoundary(ContentContainer, {
  fallback: (props) => <ErrorFallback {...props} />,
});
