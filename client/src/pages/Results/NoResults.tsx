import React, { useMemo, useState } from 'react';
import Button from '../../components/Button';
import Filters from '../../components/Filters';
import PageHeader from '../../components/ResultsPageHeader';

type Props = {
  suggestions: string[];
};

const NoResults = ({ suggestions }: Props) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const items = useMemo(
    () =>
      suggestions.map((s) => (
        <Button key={s} variant="secondary" size="small">
          {s}
        </Button>
      )),
    [suggestions],
  );
  return (
    <>
      <Filters
        isOpen={isFiltersOpen}
        toggleOpen={() => setIsFiltersOpen((prev) => !prev)}
      />
      <div className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content">
        <PageHeader
          resultsNumber={0}
          showCollapseControls={false}
          loading={false}
        />
        <div className="mt-13 select-none">
          <p className="body-s text-gray-500">Suggested combinations</p>
          <div className="flex gap-3 flex-wrap mt-6 w-1/2">{items}</div>
        </div>
      </div>
    </>
  );
};

export default NoResults;
