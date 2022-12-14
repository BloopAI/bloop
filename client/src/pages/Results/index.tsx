import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import {
  DirectoryResult,
  FullResult,
  ResultItemType,
  ResultType,
} from '../../types/results';
import { SearchContext } from '../../context/searchContext';
import {
  mapDirResult,
  mapFileResult,
  mapRanges,
  mapResults,
} from '../../mappers/results';
import { mapFiltersData } from '../../mappers/filter';
import { UIContext } from '../../context/uiContext';
import { useSearch } from '../../hooks/useSearch';
import { FullResultModeEnum } from '../../types/general';
import { SearchResponse } from '../../types/api';
import Filters from '../../components/Filters';
import RepositoryPage from '../Repository';
import PageTemplate from '../../components/PageTemplate';
import { getHoverables } from '../../services/api';
import ErrorFallback from '../../components/ErrorFallback';
import ResultsList from './ResultsList';
import PageHeader from './PageHeader';
import NoResults from './NoResults';
import ResultFull from './ResultFull';
import Skeleton from './Skeleton';

const mockQuerySuggestions = [
  'repo:cobra-ats  error:“no apples”',
  'error:“no apples”',
  'no apples',
  'repo:cobra-ats apples',
  'lang:tsx apples',
];

const ResultsPage = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [mode, setMode] = useState<FullResultModeEnum>(
    FullResultModeEnum.SIDEBAR,
  );
  const [openResult, setOpenResult] = useState<FullResult | null>(null);
  const [results, setResults] = useState<ResultType[]>([]);
  const [dirResult, setDirResults] = useState<DirectoryResult | null>();
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(1);
  const [initialLoad, setInitialLoad] = useState(true);
  const [isFileNav, setIsFileNav] = useState(false);

  const { filters, setFilters, setInputValue, inputValue, globalRegex } =
    useContext(SearchContext);
  const { setSymbolsCollapsed } = useContext(UIContext);
  const { searchQuery, data, loading } = useSearch<SearchResponse>();
  const [searchParams] = useSearchParams();
  const queryString = useMemo(() => searchParams.get('q'), [searchParams]);

  const navigate = useNavigate();

  useEffect(() => {
    if (queryString) {
      setInputValue(queryString);
      searchQuery(queryString, 0, globalRegex);
      setPage(0);
    }
  }, [queryString]);

  const onlySymbolResults = useMemo(
    () =>
      results.every(
        (item) =>
          item.type === ResultItemType.CODE &&
          item.snippets.every((sItem) => sItem.symbols?.length),
      ),
    [results, page],
  );
  useEffect(() => {
    setSymbolsCollapsed(onlySymbolResults);
  }, [onlySymbolResults]);

  useEffect(() => {
    if (!data) {
      return;
    }
    const firstItem = data.data[0];
    switch (firstItem?.kind) {
      case 'dir':
        setResults([]);
        setOpenResult(null);
        setDirResults(mapDirResult(firstItem));
        break;
      case 'file':
        setOpenResult(mapFileResult(firstItem));
        getHoverables(
          firstItem.data.relative_path,
          firstItem.data.repo_ref,
        ).then((data) => {
          setOpenResult((prevState) => ({
            ...prevState!,
            hoverableRanges: mapRanges(data.ranges),
          }));
        });
        break;
      default:
        setDirResults(null);
        setOpenResult(null);
        setIsFileNav(false);
        if (page === 0) {
          setTotalPages(data.metadata.page_count);
          setTotalCount(data.metadata.total_count);
        }
        setFilters(mapFiltersData(data.stats, filters));
        setResults(mapResults(data));
        break;
    }

    setInitialLoad(false);
  }, [data]);

  useEffect(() => {
    if (!isFileNav) {
      ref.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }, [page]);

  const onResultClosed = useCallback(
    (navigateBack: boolean = true) => {
      if (mode === FullResultModeEnum.SIDEBAR) {
        setIsFiltersOpen(true);
      }
      if (navigateBack) {
        navigate(-1);
      }
      setOpenResult(null);
    },
    [mode],
  );

  const handleModeChange = useCallback((m: FullResultModeEnum) => {
    setMode(m);
    if (m === FullResultModeEnum.SIDEBAR) {
      setIsFiltersOpen(false);
    }
  }, []);

  const onResultClick = useCallback(
    (repo?: string, path?: string) => {
      navigate(
        `/results?q=open:true ${
          repo ? `repo:${encodeURIComponent(repo)}` : ''
        } ${path ? `path:${encodeURIComponent(path)}` : ''}`,
        { replace: !!openResult },
      );
      setIsFileNav(true);
    },
    [openResult],
  );

  const toggleFiltersOpen = useCallback(() => {
    setIsFiltersOpen((prev) => !prev);
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      searchQuery(inputValue, page, globalRegex);
      setPage(page);
    },
    [inputValue, globalRegex],
  );

  const renderPage = () => {
    if (initialLoad) {
      return <Skeleton />;
    } else if (dirResult) {
      return (
        <RepositoryPage
          sidebarOpen={!!openResult}
          repository={{
            name: dirResult.name,
            fileCount: 0,
            files: dirResult.entries,
            commits: [],
            url: '',
            description: '',
            branches: [],
            followers: 1,
            currentPath: dirResult.relativePath,
          }}
        />
      );
    }
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
            loading={loading && !isFileNav}
          />
          {results.length || loading ? (
            <ResultsList
              results={results}
              onResultClick={onResultClick}
              page={page}
              setPage={handlePageChange}
              totalPages={totalPages}
              loading={loading && !isFileNav}
            />
          ) : (
            <NoResults suggestions={mockQuerySuggestions} />
          )}
        </div>
      </>
    );
  };

  return (
    <PageTemplate>
      {renderPage()}
      <ResultFull
        result={openResult as FullResult}
        onResultClosed={onResultClosed}
        mode={mode}
        setMode={handleModeChange}
      />
    </PageTemplate>
  );
};

export default Sentry.withErrorBoundary(ResultsPage, {
  fallback: (props) => <ErrorFallback {...props} />,
});
