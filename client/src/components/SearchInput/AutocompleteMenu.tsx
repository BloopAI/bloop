import React, { useMemo, useState } from 'react';
import { ResultItemType, SuggestionType } from '../../types/results';
import AutocompleteMenuItem from './AutocompleteMenuItem';

type Props = {
  getMenuProps: () => any;
  getItemProps: ({
    item,
    index,
  }: {
    item: SuggestionType;
    index: number;
  }) => any;
  left: number;
  isOpen: boolean;
  options: SuggestionType[];
};

const AutocompleteMenu = ({
  getMenuProps,
  left,
  isOpen,
  options,
  getItemProps,
}: Props) => {
  const [allResultsShown, setAllResultsShown] = useState(false);

  const queryOptions = useMemo(
    () =>
      options.filter(
        (o) =>
          o.type === ResultItemType.FLAG ||
          o.type === ResultItemType.LANG ||
          o.type === ResultItemType.FILE ||
          o.type === ResultItemType.REPO,
      ),
    [options],
  );
  const resultOptions = useMemo(
    () => options.filter((o) => o.type === ResultItemType.CODE),
    [options],
  );
  const containerStyle = useMemo(
    () => ({
      left,
    }),
    [left],
  );
  return (
    <div
      className={`text-gray-500 absolute top-[40px] list-none p-0 ${
        resultOptions.length ? 'w-98' : 'w-68 '
      } bg-gray-800 bg-opacity-75 backdrop-blur-6 ${
        isOpen ? 'block' : 'hidden'
      } border border-gray-700 rounded-4 shadow-light-bigger overflow-auto max-h-[calc(100vh-130px)]`}
      style={containerStyle}
    >
      <ul {...getMenuProps()}>
        {isOpen ? (
          <>
            {queryOptions.length ? (
              <span className="text-gray-500 caption p-2">
                Query suggestions
              </span>
            ) : null}
            {queryOptions.map((item, index) => (
              <AutocompleteMenuItem
                key={`${item}${index}`}
                item={item}
                index={index}
                getItemProps={getItemProps}
              />
            ))}
            {resultOptions.length ? (
              <span className="text-gray-500 caption p-2">
                Result suggestions
              </span>
            ) : null}
            {resultOptions
              .slice(0, allResultsShown ? undefined : 2)
              .map((item, index) => (
                <AutocompleteMenuItem
                  key={`${item}${index}`}
                  item={item}
                  index={queryOptions.length + index}
                  getItemProps={getItemProps}
                />
              ))}
            {resultOptions.length > 2 ? (
              <button
                onClick={() => setAllResultsShown((prev) => !prev)}
                className="text-gray-300 cursor-pointer w-full h-9 flex justify-between items-center px-1.5 py-2.5 hover:bg-gray-700 gap-1 border-transparent border-l-2 hover:border-primary-400 caption arrow-navigate focus:bg-gray-700 focus:border-primary-400 focus:outline-none outline-none outline-0 transition duration-150 ease-in-slow"
              >
                {allResultsShown ? 'Show fewer results' : 'View all results'}
              </button>
            ) : null}
          </>
        ) : null}
      </ul>
    </div>
  );
};

export default AutocompleteMenu;
