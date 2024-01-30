import { Align, FixedSizeList } from 'react-window';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Token as TokenType } from '../../../types/prism';
import { Range } from '../../../types/results';
import { getOffsetForIndexAndAlignment } from '../../../utils/scrollUtils';
import CodeLine from '../CodeLine';
import { useDiffLines } from '../../../hooks/useDiffLines';
import Token from './Token';

type Props = {
  hoverableRanges?: Record<number, Range[]>;
  tokens: TokenType[][];
  scrollToIndex?: number[];
  width: number;
  height: number;
  getHoverableContent: (
    hoverableRange: Range,
    tokenRange: Range,
    lineNumber: number,
  ) => void;
  highlights?: (
    | { lines: [number, number]; color: string; index: number }
    | undefined
  )[];
  hoveredLines?: [number, number] | null;
  isDiff?: boolean;
  searchTerm?: string;
};

const VirtualizedCode = ({
  tokens,
  hoverableRanges,
  scrollToIndex,
  width,
  height,
  getHoverableContent,
  highlights,
  hoveredLines,
  isDiff,
  searchTerm,
}: Props) => {
  const ref = useRef<FixedSizeList>(null);
  const listProps = useMemo(
    () => ({
      width,
      height,
      itemSize: 20,
      itemCount: tokens.length + 2, // to add padding at the bottom
      overscanCount: 5,
    }),
    [width, height, tokens.length],
  );
  const { lineNumbersAdd, lineNumbersRemove } = useDiffLines(tokens, !isDiff);

  useEffect(() => {
    if (scrollToIndex && ref.current) {
      let scrollToItem = scrollToIndex[0];
      let align: Align = 'center';
      let multiline = scrollToIndex[1] && scrollToIndex[0] !== scrollToIndex[1];
      if (multiline && scrollToIndex[1] - scrollToIndex[0] < 8) {
        scrollToItem =
          scrollToIndex[0] +
          Math.floor((scrollToIndex[1] - scrollToIndex[0]) / 2);
      } else if (multiline) {
        align = 'start';
      }
      scrollToItem = Math.max(0, Math.min(scrollToItem, tokens.length - 1));
      const scrollOffset = getOffsetForIndexAndAlignment(
        listProps,
        scrollToItem,
        align,
        0,
      );
      ref.current.scrollTo(scrollOffset);
    }
  }, [scrollToIndex, listProps]);

  return (
    <FixedSizeList ref={ref} {...listProps}>
      {({ index, style }) => {
        let highlightForLine = highlights?.findIndex(
          (h) => h && index >= h.lines[0] && index <= h.lines[1],
        );
        if (highlightForLine && highlightForLine < 0) {
          highlightForLine = undefined;
        }
        return index < tokens.length ? (
          <CodeLine
            key={index.toString()}
            lineNumber={index}
            showLineNumbers
            hoverEffect
            style={style}
            searchTerm={searchTerm}
            shouldHighlight={
              (!!scrollToIndex &&
                index >= scrollToIndex[0] &&
                index <= scrollToIndex[1]) ||
              (highlights && highlightForLine !== undefined)
            }
            highlightColor={
              highlights && highlightForLine !== undefined
                ? highlights[highlightForLine]?.color
                : undefined
            }
            hoveredBackground={
              !!hoveredLines &&
              index >= hoveredLines[0] &&
              index <= hoveredLines[1]
            }
            isNewLine={
              isDiff &&
              (tokens[index][0]?.content === '+' ||
                tokens[index][1]?.content === '+')
            }
            isRemovedLine={
              isDiff &&
              (tokens[index][0]?.content === '-' ||
                tokens[index][1]?.content === '-')
            }
            lineNumbersDiff={
              isDiff ? [lineNumbersRemove[index], lineNumbersAdd[index]] : null
            }
          >
            {tokens[index].map((token, i) => (
              <Token
                key={`cell-${index}-${i}`}
                lineHoverRanges={hoverableRanges?.[index]}
                token={token}
                getHoverableContent={getHoverableContent}
                lineNumber={index}
              />
            ))}
          </CodeLine>
        ) : (
          <div className="w-fll h-5" />
        );
      }}
    </FixedSizeList>
  );
};

export default memo(VirtualizedCode);
