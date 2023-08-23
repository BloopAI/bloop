import React, { Fragment, memo, useEffect, useRef, useState } from 'react';
import { Token as TokenType } from '../../../types/prism';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import CodeLine from './CodeLine';
import SelectionHandler from './SelectionHandler';

type Props = {
  tokens: TokenType[][];
  searchTerm: string;
  pathHash: string | number;
  onMouseSelectStart: (lineNum: number) => void;
  onMouseSelectEnd: (lineNum: number) => void;
  scrollToIndex?: number[];
  currentSelection: ([number, number] | [number])[];
  updateRange: (i: number, newRange: [number, number]) => void;
  deleteRange: (i: number) => void;
};

const CodeContainerFull = ({
  tokens,
  searchTerm,
  pathHash,
  onMouseSelectStart,
  onMouseSelectEnd,
  scrollToIndex,
  currentSelection,
  updateRange,
  deleteRange,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [currentlySelectingLine, setCurrentlySelectingLine] = useState(0);
  const [currentlySelectingRange, setCurrentlySelectingRange] = useState<
    null | [number, number]
  >(null);
  const [modifyingRange, setModifyingRange] = useState(-1);

  useEffect(() => {
    if (scrollToIndex && ref.current) {
      let scrollToItem = scrollToIndex[0];
      // eslint-disable-next-line no-undef
      let align: ScrollLogicalPosition = 'center';
      let multiline = scrollToIndex[1] && scrollToIndex[0] !== scrollToIndex[1];
      if (multiline && scrollToIndex[1] - scrollToIndex[0] < 8) {
        scrollToItem =
          scrollToIndex[0] +
          Math.floor((scrollToIndex[1] - scrollToIndex[0]) / 2);
      } else if (multiline) {
        align = 'start';
      }
      scrollToItem = Math.max(0, Math.min(scrollToItem, tokens.length - 1));
      let line = findElementInCurrentTab(
        `.modal-or-sidebar [data-line-number="${scrollToItem}"]`,
      );
      if (!line) {
        line = findElementInCurrentTab(`[data-line-number="${scrollToItem}"]`);
      }
      line?.scrollIntoView({
        behavior: 'smooth',
        block: align,
      });
    }
  }, [scrollToIndex, tokens.length]);

  return (
    <div ref={ref} className="relative pb-60">
      {currentSelection.map(
        (r, i) =>
          r.length === 2 && (
            <SelectionHandler
              key={i}
              initialRange={r}
              updateRange={updateRange}
              setCurrentlySelectingRange={setCurrentlySelectingRange}
              deleteRange={deleteRange}
              i={i}
              setModifyingRange={setModifyingRange}
            />
          ),
      )}
      {tokens.map((line, index) => {
        const selectedRange =
          currentSelection.find(
            (s, i) =>
              (i !== modifyingRange &&
                s[0] <= index &&
                ((s[1] && s[1] >= index) ||
                  (!s[1] &&
                    currentlySelectingLine &&
                    currentlySelectingLine >= index))) ||
              (s[0] >= index &&
                !s[1] &&
                i !== modifyingRange &&
                currentlySelectingLine &&
                currentlySelectingLine <= index),
          ) ||
          (currentlySelectingRange &&
            currentlySelectingRange[0] <= index &&
            currentlySelectingRange[1] >= index);
        return (
          <CodeLine
            key={pathHash + '-' + index.toString()}
            lineNumber={index}
            onMouseSelectStart={onMouseSelectStart}
            onMouseSelectEnd={onMouseSelectEnd}
            searchTerm={searchTerm}
            isSelected={!!selectedRange}
            setCurrentlySelectingLine={setCurrentlySelectingLine}
            isSelectionDisabled={modifyingRange > -1}
          >
            {line.map((token, i) => (
              <span
                className={`token  ${token.types
                  .filter((t) => t !== 'table')
                  .join(' ')}`}
                key={`cell-${index}-${i}`}
              >
                {token.content}
              </span>
            ))}
          </CodeLine>
        );
      })}
    </div>
  );
};

export default memo(CodeContainerFull);
