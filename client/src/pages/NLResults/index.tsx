import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import { useNavigate } from 'react-router-dom';
import { FullResult, ResultClick } from '../../types/results';
import Filters from '../../components/Filters';
import { mapFileResult, mapRanges } from '../../mappers/results';
import { FullResultModeEnum, SearchType } from '../../types/general';
import useAppNavigation from '../../hooks/useAppNavigation';
import ResultModal from '../ResultModal';
import { useSearch } from '../../hooks/useSearch';
import { FileSearchResponse, NLSearchResponse } from '../../types/api';
import ErrorFallback from '../../components/ErrorFallback';
import { getHoverables } from '../../services/api';
import NoResults from '../Results/NoResults';
import { ResultsPreviewSkeleton } from '../Skeleton';
import SemanticSearch from '../../components/CodeBlock/SemanticSearch';
import PageHeader from './PageHeader';

type Props = {
  resultsData?: NLSearchResponse;
  loading: boolean;
  handleRetry: () => void;
  nlQuery?: string;
};

const mockQuerySuggestions = [
  'repo:cobra-ats  error:“no apples”',
  'error:“no apples”',
  'no apples',
  'repo:cobra-ats apples',
  'lang:tsx apples',
];

const ResultsPage = ({ resultsData, loading, handleRetry, nlQuery }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [mode, setMode] = useState<FullResultModeEnum>(
    FullResultModeEnum.SIDEBAR,
  );
  const [scrollToLine, setScrollToLine] = useState<string | undefined>(
    undefined,
  );
  const [openResult, setOpenResult] = useState<FullResult | null>(null);
  const { navigateRepoPath } = useAppNavigation();
  const { searchQuery: fileModalSearchQuery, data: fileResultData } =
    useSearch<FileSearchResponse>();
  const navigateBrowser = useNavigate();

  const toggleFiltersOpen = useCallback(() => {
    setIsFiltersOpen((prev) => !prev);
  }, []);

  const onResultClick = useCallback<ResultClick>((repo, path, lineNumber) => {
    setScrollToLine(lineNumber ? lineNumber.join('_') : undefined);
    if (path) {
      fileModalSearchQuery(
        `open:true repo:${repo} path:${path}`,
        0,
        false,
        SearchType.REGEX,
      );
    } else {
      navigateRepoPath(repo);
    }
  }, []);

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
    if (fileResultData) {
      setOpenResult(mapFileResult(fileResultData.data[0]));
      navigateBrowser({
        search: scrollToLine
          ? '?' +
            new URLSearchParams({
              scroll_line_index: scrollToLine.toString(),
            }).toString()
          : '',
      });
      getHoverables(
        fileResultData.data[0].data.relative_path,
        fileResultData.data[0].data.repo_ref,
      ).then((data) => {
        setOpenResult((prevState) => ({
          ...prevState!,
          hoverableRanges: mapRanges(data.ranges),
        }));
      });
    }
  }, [fileResultData]);

  const renderResults = () => {
    if (loading) {
      return <ResultsPreviewSkeleton />;
    }
    if (!resultsData) {
      return <NoResults suggestions={mockQuerySuggestions} />;
    }
    return (
      <SemanticSearch
        snippets={resultsData.snippets.map((item) => ({
          path: item.relative_path,
          code: item.text,
          repoName: item.repo_name,
          lang: item.lang,
          line: item.start_line,
          subSnippets: item.sub_snippets,
        }))}
        searchId={resultsData.query_id}
        nlQuery={nlQuery}
        onClick={onResultClick}
        handleRetry={handleRetry}
      />
    );
  };
  return (
    <>
      <Filters isOpen={isFiltersOpen} toggleOpen={toggleFiltersOpen} />
      <div
        className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content"
        ref={ref}
      >
        <PageHeader resultsNumber={1} loading={loading} />
        {renderResults()}
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
