import { useMemo } from 'react';
import Button from '../Button';
import { ArrowLeft, ArrowRight } from '../../icons';
import PaginationButton from './PaginationButton';

type Props = {
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
};

const PAGES_TO_SHOW = 6;

const Pagination = ({ page, setPage, totalPages }: Props) => {
  const pagesRange = useMemo(
    () =>
      new Array(totalPages)
        .fill(1)
        .map((n, i) => i)
        .slice(
          Math.max(
            Math.max(page - PAGES_TO_SHOW / 2, 0) -
              Math.max(0, page + PAGES_TO_SHOW / 2 - totalPages),
            0,
          ),
          Math.min(page + PAGES_TO_SHOW / 2, totalPages) +
            Math.max(PAGES_TO_SHOW / 2 - page, 0),
        ),
    [totalPages, page],
  );

  return (
    <div className="flex items-center justify-between">
      <p className="body-s text-gray-400">
        Showing page {page + 1} of {totalPages}
      </p>
      <div className="flex items-center gap-3">
        <Button
          variant="tertiary"
          size="small"
          onlyIcon
          onClick={() => setPage(page - 1)}
          disabled={page === 0}
          title="Previous page"
        >
          <ArrowLeft />
        </Button>
        {pagesRange.map((p) => (
          <PaginationButton
            key={p}
            onClick={() => setPage(p)}
            page={p + 1}
            active={page === p}
          />
        ))}
        <Button
          variant="tertiary"
          size="small"
          onlyIcon
          onClick={() => setPage(page + 1)}
          disabled={page === totalPages - 1}
          title="Next page"
        >
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
