import React, { useMemo } from 'react';
import Button from '../../components/Button';

type Props = {
  suggestions: string[];
};

const NoResults = ({ suggestions }: Props) => {
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
    <div className="mt-13 select-none">
      <p className="body-s text-gray-500">Suggested combinations</p>
      <div className="flex gap-3 flex-wrap mt-6 w-1/2">{items}</div>
    </div>
  );
};

export default NoResults;
