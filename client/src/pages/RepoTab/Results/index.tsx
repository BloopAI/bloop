import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import {
  ResultClick,
  ResultItemType,
  ResultType,
} from '../../../types/results';
import { SearchContext } from '../../../context/searchContext';
import { mapFiltersData } from '../../../mappers/filter';
import { mapResults } from '../../../mappers/results';
import { UIContext } from '../../../context/uiContext';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { GeneralSearchResponse } from '../../../types/api';
import ErrorFallback from '../../../components/ErrorFallback';
import PageHeader from '../../../components/ResultsPageHeader';
import { FileModalContext } from '../../../context/fileModalContext';
import ResultsList from './ResultsList';

type Props = {
  resultsData: GeneralSearchResponse;
  loading: boolean;
};

const ResultsPage = ({ resultsData, loading }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [totalCount, setTotalCount] = useState(1);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [results, setResults] = useState<ResultType[]>([]);
  const { filters, setFilters } = useContext(SearchContext.Filters);
  const { inputValue } = useContext(SearchContext.InputValue);
  const { globalRegex } = useContext(SearchContext.RegexEnabled);
  const { openFileModal } = useContext(FileModalContext);
  const { setSymbolsCollapsed } = useContext(UIContext.Symbols);
  const { navigateSearch, navigateRepoPath } = useAppNavigation();

  const onlySymbolResults = useMemo(
    () =>
      results.every(
        (item) =>
          item.type === ResultItemType.CODE &&
          item.snippets.every((sItem) => sItem.symbols?.length),
      ),
    [results, page],
  );

  const onResultClick = useCallback<ResultClick>(
    (repo, path, lineNumber) => {
      if (path && !(path.endsWith('/') || path.endsWith('\\'))) {
        openFileModal(path, lineNumber ? lineNumber.join('_') : undefined);
      } else {
        navigateRepoPath(repo, path);
      }
    },
    [navigateRepoPath, openFileModal],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setPage(page);
      navigateSearch(inputValue, page);
    },
    [inputValue, globalRegex],
  );

  useEffect(() => {
    setSymbolsCollapsed(onlySymbolResults);
  }, [onlySymbolResults]);

  useEffect(() => {
    if (resultsData) {
      if (page === 0) {
        setTotalPages(resultsData.metadata.page_count!);
        setTotalCount(resultsData.metadata.total_count!);
      }
      setFilters(mapFiltersData(resultsData.stats, filters));
      setResults(mapResults(resultsData as any));
      setPage(resultsData.metadata.page!);
    }
  }, [resultsData]);

  return (
    <div
      className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content pb-60"
      ref={ref}
    >
      <PageHeader
        resultsNumber={totalCount || results.length}
        showCollapseControls={onlySymbolResults}
        loading={loading}
      />
      <ResultsList
        results={results}
        onResultClick={onResultClick}
        page={page}
        setPage={handlePageChange}
        totalPages={totalPages}
        loading={loading}
      />
    </div>
  );
};
export default Sentry.withErrorBoundary(ResultsPage, {
  fallback: (props) => <ErrorFallback {...props} />,
});
