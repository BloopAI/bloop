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
              deleteRange={deleteRange}
              i={i}
            />
          ),
      )}
      {tokens.map((line, index) => {
        const selectedRange = currentSelection.find(
          (s) =>
            (s[0] <= index &&
              ((s[1] && s[1] >= index) ||
                (!s[1] &&
                  currentlySelectingLine &&
                  currentlySelectingLine >= index))) ||
            (s[0] >= index &&
              !s[1] &&
              currentlySelectingLine &&
              currentlySelectingLine <= index),
        );
        return (
          <CodeLine
            key={pathHash + '-' + index.toString()}
            lineNumber={index}
            onMouseSelectStart={onMouseSelectStart}
            onMouseSelectEnd={onMouseSelectEnd}
            searchTerm={searchTerm}
            isSelected={!!selectedRange}
            setCurrentlySelectingLine={setCurrentlySelectingLine}
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
