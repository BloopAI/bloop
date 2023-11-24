import React, { memo, useMemo } from 'react';
import { Trans } from 'react-i18next';
import { ResultItemType, SuggestionType } from '../../../types/results';
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
  isOpen: boolean;
  options: SuggestionType[];
  highlightedIndex: number;
};

const AutocompleteMenu = ({
  getMenuProps,
  isOpen,
  options,
  getItemProps,
  highlightedIndex,
}: Props) => {
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

  return (
    <div className={`list-none`}>
      <ul {...getMenuProps()}>
        {isOpen && (
          <>
            {queryOptions.length ? (
              <span className="text-label-base body-mini-b p-2">
                <Trans>Query suggestions</Trans>
              </span>
            ) : null}
            {queryOptions.map((item, index) => (
              <AutocompleteMenuItem
                key={`${item}${index}`}
                item={item}
                index={index}
                isFocused={highlightedIndex === index}
                getItemProps={getItemProps}
                isFirst={index === 0}
              />
            ))}
            {resultOptions.length ? (
              <span className="text-label-base body-mini-b p-2">
                <Trans>Result suggestions</Trans>
              </span>
            ) : null}
            {resultOptions.map((item, index) => (
              <AutocompleteMenuItem
                key={`${item}${index}`}
                item={item}
                index={queryOptions.length + index}
                isFocused={highlightedIndex === index + queryOptions.length}
                getItemProps={getItemProps}
                isFirst={index === 0}
              />
            ))}
          </>
        )}
      </ul>
    </div>
  );
};

export default memo(AutocompleteMenu);
