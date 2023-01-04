import React, { useContext, useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react';
import { SearchContext } from '../../context/searchContext';
import { useSearch } from '../../hooks/useSearch';
import {
  DirectorySearchResponse,
  GeneralSearchResponse,
  NLSearchResponse,
  SearchResponse,
} from '../../types/api';
import RepositoryPage from '../Repository';
import PageTemplate from '../../components/PageTemplate';
import ErrorFallback from '../../components/ErrorFallback';
import useAppNavigation from '../../hooks/useAppNavigation';
import { buildRepoQuery } from '../../utils';
import ResultsPage from '../Results';
import ViewResult from '../ResultFull';
import { SearchType } from '../../types/general';
import NLResults from '../NLResults';

const SearchPage = () => {
  const { setInputValue, globalRegex, searchType, setSearchType } =
    useContext(SearchContext);
  const [resultsData, setResultsData] = useState<SearchResponse>();
  const [nlResultsData, setNLResultsData] = useState<
    NLSearchResponse | undefined
  >();
  const { searchQuery, data, loading } = useSearch<SearchResponse>();
  const {
    searchQuery: nlSearchQuery,
    data: nlData,
    loading: nlLoading,
  } = useSearch<NLSearchResponse>();

  const { navigatedItem, query } = useAppNavigation();

  useEffect(() => {
    if (!navigatedItem) {
      return;
    }

    setInputValue(query);

    switch (navigatedItem.type) {
      case 'repo':
      case 'full-result':
        searchQuery(
          buildRepoQuery(navigatedItem.repo, navigatedItem.path),
          0,
          false,
          SearchType.REGEX,
        );
        break;
      default:
        if (searchType === SearchType.NL) {
          nlSearchQuery(navigatedItem.query!);
        } else {
          searchQuery(navigatedItem.query!, navigatedItem.page, globalRegex);
        }
    }
  }, [navigatedItem, searchType]);

  const [renderPage, setRenderPage] = useState<
    'results' | 'repo' | 'full-result' | 'nl-result' | 'no-results'
  >();

  useEffect(() => {
    if (searchType === SearchType.REGEX) {
      return;
    }
    if (!nlData?.selection) {
      setNLResultsData(undefined);
    } else {
      setNLResultsData(nlData);
    }
    setRenderPage('nl-result');
  }, [nlData, searchType]);

  useEffect(() => {
    if (
      searchType === SearchType.NL &&
      !['repo', 'full-result'].includes(navigatedItem?.type || '')
    ) {
      return;
    }
    if (loading) {
      return;
    }
    if (!data?.data[0]) {
      setRenderPage('no-results');
      setResultsData({ data: [], metadata: {}, stats: {} });
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
  }, [loading, data, searchType]);

  const renderedPage = useMemo(() => {
    switch (renderPage) {
      case 'results':
      case 'no-results':
        return (
          <ResultsPage
            resultsData={resultsData as GeneralSearchResponse}
            loading={loading}
          />
        );
      case 'repo':
        return <RepositoryPage repositoryData={resultsData} />;
      case 'full-result':
        return <ViewResult data={resultsData} />;
      case 'nl-result':
        return <NLResults loading={nlLoading} resultsData={nlResultsData} />;
    }
  }, [renderPage, resultsData, loading, nlLoading, nlResultsData]);

  return <PageTemplate>{renderedPage}</PageTemplate>;
};

export default Sentry.withErrorBoundary(SearchPage, {
  fallback: (props) => <ErrorFallback {...props} />,
});
