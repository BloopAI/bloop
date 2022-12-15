import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import { FullResult, ResultItemType, ResultType } from '../../types/results';
import Filters from '../../components/Filters';
import { SearchContext } from '../../context/searchContext';
import { mapFiltersData } from '../../mappers/filter';
import { mapFileResult, mapResults } from '../../mappers/results';
import { FullResultModeEnum } from '../../types/general';
import { UIContext } from '../../context/uiContext';
import useAppNavigation from '../../hooks/useAppNavigation';
import ResultModal from '../ResultModal';
import { useSearch } from '../../hooks/useSearch';
import { FileSearchResponse, GeneralSearchResponse } from '../../types/api';
import ErrorFallback from '../../components/ErrorFallback';
import PageHeader from './PageHeader';
import ResultsList from './ResultsList';
import NoResults from './NoResults';

const mockQuerySuggestions = [
  'repo:cobra-ats  error:“no apples”',
  'error:“no apples”',
  'no apples',
  'repo:cobra-ats apples',
  'lang:tsx apples',
];

type Props = {
  resultsData: GeneralSearchResponse;
  loading: boolean;
};

const ResultsPage = ({ resultsData, loading }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [totalCount, setTotalCount] = useState(1);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  // const [totalPages, setTotalPages] = usePersistentState(1,'totalPages');
  const [results, setResults] = useState<ResultType[]>([]);
  const [mode, setMode] = useState<FullResultModeEnum>(
    FullResultModeEnum.SIDEBAR,
  );
  const [openResult, setOpenResult] = useState<FullResult | null>(null);
  const { filters, setFilters, inputValue, globalRegex } =
    useContext(SearchContext);
  const { setSymbolsCollapsed } = useContext(UIContext);
  const { navigateSearch, navigateRepoPath } = useAppNavigation();
  const { searchQuery: fileModalSearchQuery, data: fileResultData } =
    useSearch<FileSearchResponse>();

  const toggleFiltersOpen = useCallback(() => {
    setIsFiltersOpen((prev) => !prev);
  }, []);

  const onlySymbolResults = useMemo(
    () =>
      results.every(
        (item) =>
          item.type === ResultItemType.CODE &&
          item.snippets.every((sItem) => sItem.symbols?.length),
      ),
    [results, page],
  );

  const onResultClick = useCallback((repo: string, path?: string) => {
    if (path) {
      fileModalSearchQuery(`open:true repo:${repo} path:${path}`);
    } else {
      navigateRepoPath(repo);
    }
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      setPage(page);
      navigateSearch(inputValue, page);
    },
    [inputValue, globalRegex],
  );

  const handleModeChange = useCallback((m: FullResultModeEnum) => {
    setMode(m);
    if (m === FullResultModeEnum.SIDEBAR) {
      setIsFiltersOpen(false);
    }
  }, []);

  const onResultClosed = useCallback(() => {
    if (mode === FullResultModeEnum.SIDEBAR) {
      setIsFiltersOpen(true);
    }
    setOpenResult(null);
  }, [mode]);

  useEffect(() => {
    setSymbolsCollapsed(onlySymbolResults);
  }, [onlySymbolResults]);

  useEffect(() => {
    if (page === 0) {
      setTotalPages(resultsData.metadata.page_count);
      setTotalCount(resultsData.metadata.total_count);
    }
    setFilters(mapFiltersData(resultsData.stats, filters));
    setResults(mapResults(resultsData));
    setPage(resultsData.metadata.page);
  }, [resultsData]);

  useEffect(() => {
    if (fileResultData) {
      setOpenResult(mapFileResult(fileResultData.data[0]));
    }
  }, [fileResultData]);

  useEffect(() => {
    // if (!isFileNav) {
    //   ref.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    // }
  }, [page]);

  return (
    <>
      <Filters isOpen={isFiltersOpen} toggleOpen={toggleFiltersOpen} />
      <div
        className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content"
        ref={ref}
      >
        <PageHeader
          resultsNumber={totalCount || results.length}
          showCollapseControls={onlySymbolResults}
          loading={loading}
        />
        {results.length || loading ? (
          <ResultsList
            results={results}
            onResultClick={onResultClick}
            page={page}
            setPage={handlePageChange}
            totalPages={totalPages}
            loading={loading}
          />
        ) : (
          <NoResults suggestions={mockQuerySuggestions} />
        )}
      </div>

      {openResult ? (
        <ResultModal
          result={openResult as FullResult}
          onResultClosed={onResultClosed}
          mode={mode}
          setMode={handleModeChange}
        />
      ) : (
        ''
      )}
    </>
  );
};
export default Sentry.withErrorBoundary(ResultsPage, {
  fallback: (props) => <ErrorFallback {...props} />,
});
