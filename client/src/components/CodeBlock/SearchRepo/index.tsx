import React, { useCallback } from 'react';
import { Repository } from '../../../icons';
import { Range, ResultClick } from '../../../types/results';

type Props = {
  repository: string;
  highlights?: Range[];
  onClick?: ResultClick;
};

const SearchRepo = ({ repository, onClick, highlights }: Props) => {
  const getHighlighted = (string: string) => {
    if (!highlights) {
      return [{ text: string, hl: false }];
    }
    const highLightMap: { text: string; hl: boolean }[] = [];
    highLightMap.push({
      text: string.substring(0, highlights[0].start),
      hl: false,
    });
    highlights.forEach((hl, i) => {
      highLightMap.push({
        text: string.substring(hl.start, hl.end),
        hl: true,
      });
      highLightMap.push({
        text: string.substring(hl.end, highlights[i + 1]?.start),
        hl: false,
      });
    });

    return highLightMap;
  };
  const handleClick = useCallback(() => {
    onClick?.(repository);
  }, [repository]);

  return (
    <div className="flex flex-row w-full justify-between bg-bg-shade p-3 border border-bg-border rounded-4 text-label-base items-center">
      <span
        className={`flex flex-row gap-2 items-center ${
          onClick ? 'cursor-pointer' : ''
        }`}
        onClick={handleClick}
      >
        <Repository />

        <span className={'text-label-title'}>
          {getHighlighted(repository).map((hl, i) => (
            <span
              key={i}
              className={`${
                hl.hl
                  ? `text-label-base before:block before:absolute before:-inset-0.5 before:bg-bg-highlight/25 relative before:rounded-l before:left-[-2px] before:rounded-r before:right-[-2px]`
                  : ''
              } `}
            >
              {hl.text}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
};
export default SearchRepo;
