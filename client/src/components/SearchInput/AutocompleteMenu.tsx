import React, { useMemo, useState } from 'react';
import { Trans } from 'react-i18next';
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
      className={`absolute top-[40px] list-none p-0 ${
        resultOptions.length ? 'w-98' : 'w-68 '
      } bg-bg-shade bg-opacity-75 backdrop-blur-6 ${
        isOpen ? 'block' : 'hidden'
      } border border-bg-border rounded-4 shadow-high overflow-auto max-h-[calc(100vh-130px)]`}
      style={containerStyle}
    >
      <ul {...getMenuProps()}>
        {isOpen ? (
          <>
            {queryOptions.length ? (
              <span className="text-label-base caption p-2">
                <Trans>Query suggestions</Trans>
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
              <span className="text-label-base caption p-2">
                <Trans>Result suggestions</Trans>
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
                className="text-label-base cursor-pointer w-full h-9 flex justify-between items-center px-1.5 py-2.5 hover:bg-bg-base-hover gap-1 border-transparent border-l-2 hover:border-bg-main caption arrow-navigate focus:bg-bg-base-hover focus:border-bg-main focus:outline-none outline-none outline-0 transition duration-150 ease-in-slow"
              >
                <Trans>
                  {allResultsShown ? 'Show fewer results' : 'View all results'}
                </Trans>
              </button>
            ) : null}
          </>
        ) : null}
      </ul>
    </div>
  );
};

export default AutocompleteMenu;
