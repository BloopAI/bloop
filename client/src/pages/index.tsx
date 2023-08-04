import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import { useSearchParams } from 'react-router-dom';
import { SearchContext } from '../context/searchContext';
import { useSearch } from '../hooks/useSearch';
import {
  DirectorySearchResponse,
  GeneralSearchResponse,
  SearchResponse,
} from '../types/api';
import PageTemplate from '../components/PageTemplate';
import ErrorFallback from '../components/ErrorFallback';
import { buildRepoQuery } from '../utils';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import { UITabType } from '../types/general';
import { AppNavigationContext } from '../context/appNavigationContext';
import useUrlParser from '../hooks/useUrlParser';
import RepositoryPage from './Repository';
import ResultsPage from './Results';
import ViewResult from './ResultFull';
import NoResults from './Results/NoResults';
import HomePage from './Home';
import ArticleResponse from './ArticleResponse';

const mockQuerySuggestions = [
  'repo:cobra-ats  error:“no apples”',
  'error:“no apples”',
  'no apples',
  'repo:cobra-ats apples',
  'lang:tsx apples',
];

export type RenderPage =
  | 'results'
  | 'repo'
  | 'full-result'
  | 'no-results'
  | 'home'
  | 'article-response';

let prevRenderPage: RenderPage;

const ContentContainer = ({ tab }: { tab: UITabType }) => {
  const { setInputValue } = useContext(SearchContext.InputValue);
  const { globalRegex } = useContext(SearchContext.RegexEnabled);
  const { selectedBranch } = useContext(SearchContext.SelectedBranch);
  const { searchQuery, data, loading } = useSearch<SearchResponse>();
  const [searchParams] = useSearchParams();
  const { repoRef, page } = useUrlParser();
  const [currentPage, setCurrentPage] = useState(
    repoRef === tab.key ? page : 'repo',
  );

  const { navigateBack } = useContext(AppNavigationContext);

  useEffect(() => {
    if (repoRef === tab.key) {
      setCurrentPage(page);
    }
  }, [page, repoRef]);

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
    if (repoRef !== tab.key) {
      return;
    }

    setInputValue(
      (searchParams.get('query') || '')
        .replace(/repo:.*?\s/, '')
        .replace(/branch:.*?\s/, '')
        .replace(/branch:.*$/, '')
        .replace('open:true', '')
        .trim(),
    );

    switch (currentPage) {
      case 'repo':
      case 'full-result':
        const path = searchParams.get('path') || '';
        searchQuery(buildRepoQuery(tab.repoName, path, selectedBranch));
        break;
      case 'home':
      case 'conversation-result':
      case 'article-response':
        break;
      default:
        const query = searchParams.get('query') || '';
        const page = searchParams.get('page');
        const search = query.includes(`repo:${tab.name}`)
          ? query
          : `${query} repo:${tab.name}`;
        searchQuery(search, page ? Number(page) : undefined, globalRegex);
    }
  }, [tab.key, tab.name, selectedBranch, searchParams, currentPage]);

  const getRenderPage = useCallback((): RenderPage => {
    let renderPage: RenderPage;
    if (tab.key === 'initial') {
      return 'home';
    }
    if (
      currentPage &&
      ['full-result', 'article-response'].includes(currentPage)
    ) {
      return currentPage as 'full-result' | 'article-response';
    }
    if (!data?.data?.[0] && !loading) {
      return 'no-results';
    }
    if (loading && prevRenderPage && currentPage === 'repo') {
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
  }, [data, loading, tab.key]);

  const renderPage: RenderPage = useMemo(
    () => getRenderPage(),
    [data, loading],
  );

  const renderedPage = useMemo(() => {
    const path = searchParams.get('path');
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
            isRepo={currentPage === 'repo' && !path}
            isFolder={!!path}
            repo={currentPage === 'repo' ? tab.repoName : undefined}
            refetchRepo={() => searchQuery(buildRepoQuery(tab.repoName))}
          />
        );
      case 'repo':
        return (
          <RepositoryPage repositoryData={data as DirectorySearchResponse} />
        );
      case 'full-result':
        return (
          <ViewResult
            data={data}
            isLoading={loading}
            repoName={tab.repoName}
            selectedBranch={selectedBranch}
            recordId={Number(searchParams.get('recordId'))}
            threadId={searchParams.get('threadId') || ''}
          />
        );
      case 'article-response':
        return (
          <ArticleResponse
            recordId={Number(searchParams.get('recordId')) || -1}
            threadId={searchParams.get('threadId') || ''}
          />
        );
      default:
        return <HomePage />;
    }
  }, [data, loading, renderPage, tab.repoName, selectedBranch]);

  return <PageTemplate renderPage={renderPage}>{renderedPage}</PageTemplate>;
};

export default Sentry.withErrorBoundary(ContentContainer, {
  fallback: (props) => <ErrorFallback {...props} />,
});
