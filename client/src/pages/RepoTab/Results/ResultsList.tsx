import React, { memo, useMemo } from 'react';
import { ResultClick, ResultType } from '../../../types/results';
import Pagination from '../../../components/Pagination';
import { ResultsPreviewSkeleton } from '../../../components/Skeleton';
import ResultPreview from './ResultPreview';

type Props = {
  results: ResultType[];
  onResultClick: ResultClick;
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
  loading?: boolean;
};

const ResultsList = ({
  results,
  onResultClick,
  page,
  totalPages,
  setPage,
  loading,
}: Props) => {
  const items = useMemo(
    () =>
      results.map((r) => (
        <ResultPreview key={r.id} result={r} onClick={onResultClick} />
      )),
    [results, onResultClick],
  );
  return loading && !results?.length ? (
    <ResultsPreviewSkeleton />
  ) : (
    <>
      <ul
        className={`flex flex-col gap-3.5 overflow-auto ${
          loading ? 'opacity-50' : 'opacity-100'
        } transition-opacity duration-200`}
      >
        {items}
      </ul>
      <div className="mt-8">
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>
    </>
  );
};

export default memo(ResultsList);
