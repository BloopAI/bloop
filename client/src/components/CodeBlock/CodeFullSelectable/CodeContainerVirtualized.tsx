import { Align, FixedSizeList } from 'react-window';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Token as TokenType } from '../../../types/prism';
import { getOffsetForIndexAndAlignment } from '../../../utils/scrollUtils';
import CodeLine from './CodeLine';

type Props = {
  tokens: TokenType[][];
  searchTerm: string;
  width: number;
  height: number;
  pathHash: string | number;
  onMouseSelectStart: (lineNum: number) => void;
  onMouseSelectEnd: (lineNum: number) => void;
  scrollToIndex?: number[];
};

const CodeContainerVirtualized = ({
  tokens,
  searchTerm,
  width,
  height,
  pathHash,
  onMouseSelectStart,
  onMouseSelectEnd,
  scrollToIndex,
}: Props) => {
  const ref = useRef<FixedSizeList>(null);
  const listProps = useMemo(
    () => ({
      width,
      height,
      itemSize: 20,
      itemCount: tokens.length + 9, // to add padding at the bottom
      overscanCount: 5,
    }),
    [width, height, tokens.length],
  );

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
        return index < tokens.length ? (
          <CodeLine
            key={pathHash + '-' + index.toString()}
            lineNumber={index}
            onMouseSelectStart={onMouseSelectStart}
            onMouseSelectEnd={onMouseSelectEnd}
            searchTerm={searchTerm}
            stylesGenerated={style}
          >
            {tokens[index].map((token, i) => (
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
        ) : (
          <div className="w-fll h-5" />
        );
      }}
    </FixedSizeList>
  );
};

export default memo(CodeContainerVirtualized);
