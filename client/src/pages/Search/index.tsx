import React, { useContext, useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react';
import { SearchContext } from '../../context/searchContext';
import { useSearch } from '../../hooks/useSearch';
import { SearchResponse } from '../../types/api';
import RepositoryPage from '../Repository';
import PageTemplate from '../../components/PageTemplate';
import ErrorFallback from '../../components/ErrorFallback';
import useAppNavigation from '../../hooks/useAppNavigation';
import { buildRepoQuery } from '../../utils';
import ResultsPage from '../Results';
import ViewResult from '../ResultFull';

const SearchPage = () => {
  const { setInputValue, globalRegex } = useContext(SearchContext);
  const [resultsData, setResultsData] = useState<any>();
  const { searchQuery, data, loading } = useSearch<SearchResponse>();

  const { navigatedItem, query } = useAppNavigation();

  useEffect(() => {
    if (!navigatedItem) {
      return;
    }

    setInputValue(query);
    switch (navigatedItem.type) {
      case 'repo':
      case 'full-result':
        searchQuery(buildRepoQuery(navigatedItem.repo, navigatedItem.path));
        break;
      default:
        searchQuery(navigatedItem.query!, navigatedItem.page, globalRegex);
    }
  }, [navigatedItem]);

  const [renderPage, setRenderPage] = useState<
    'results' | 'repo' | 'full-result'
  >();

  useEffect(() => {
    if (!data?.data?.[0] || loading) {
      return;
    }
    const resultType = data.data[0].kind;
    setResultsData(data);
    switch (resultType) {
      case 'dir':
        setRenderPage('repo');
        break;
      case 'file':
        setRenderPage('full-result');
        break;
      default:
        setRenderPage('results');
    }
  }, [navigatedItem, loading, data]);

  const renderedPage = useMemo(() => {
    switch (renderPage) {
      case 'results':
        return <ResultsPage resultsData={resultsData} loading={loading} />;
      case 'repo':
        return (
          <RepositoryPage repositoryData={resultsData} loading={loading} />
        );
      case 'full-result':
        return <ViewResult data={resultsData} />;
    }
  }, [renderPage, resultsData, loading]);

  return <PageTemplate>{renderedPage}</PageTemplate>;
};

export default Sentry.withErrorBoundary(SearchPage, {
  fallback: (props) => <ErrorFallback {...props} />,
});
