import React, { memo, useEffect, useRef } from 'react';
import { Token as TokenType } from '../../../types/prism';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import CodeLine from './CodeLine';

type Props = {
  tokens: TokenType[][];
  searchTerm: string;
  pathHash: string | number;
  onMouseSelectStart: (lineNum: number) => void;
  onMouseSelectEnd: (lineNum: number) => void;
  scrollToIndex?: number[];
  currentSelection: ([number, number] | [number])[];
};

const CodeContainerFull = ({
  tokens,
  searchTerm,
  pathHash,
  onMouseSelectStart,
  onMouseSelectEnd,
  scrollToIndex,
  currentSelection,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);

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
      {tokens.map((line, index) => {
        return (
          <CodeLine
            key={pathHash + '-' + index.toString()}
            lineNumber={index}
            onMouseSelectStart={onMouseSelectStart}
            onMouseSelectEnd={onMouseSelectEnd}
            searchTerm={searchTerm}
            isSelected={currentSelection.find(
              (s) => s[0] >= index && s[1] && s[1] <= index,
            )}
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
