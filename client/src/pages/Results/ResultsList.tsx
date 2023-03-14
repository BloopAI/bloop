import React, { useMemo } from 'react';
import { ResultClick, ResultType } from '../../types/results';
import Pagination from '../../components/Pagination';
import { ResultsPreviewSkeleton } from '../Skeleton';
import { RESULTS_LIST } from '../../consts/elementIds';
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
      results.map((r, i) => (
        <ResultPreview
          key={r.id}
          result={r}
          onClick={onResultClick}
          index={i}
        />
      )),
    [results, onResultClick],
  );
  return loading ? (
    <ResultsPreviewSkeleton />
  ) : (
    <>
      <ul className="flex flex-col gap-3.5 overflow-auto" id={RESULTS_LIST}>
        {items}
      </ul>
      <div className="mt-8">
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>
    </>
  );
};

export default ResultsList;
