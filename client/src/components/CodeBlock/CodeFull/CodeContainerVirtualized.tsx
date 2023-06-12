import { Align, FixedSizeList } from 'react-window';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import CodeLine from '../Code/CodeLine';
import { Token as TokenType } from '../../../types/prism';
import { propsAreShallowEqual } from '../../../utils';
import { TokenInfoItem } from '../../../types/results';
import { getOffsetForIndexAndAlignment } from '../../../utils/scrollUtils';
import Token from './Token';
import { Metadata, BlameLine } from './index';

type Props = {
  language: string;
  metadata: Metadata;
  relativePath: string;
  repoPath: string;
  repoName: string;
  tokens: TokenType[][];
  foldableRanges: Record<number, number>;
  foldedLines: Record<number, number>;
  blameLines: Record<number, BlameLine>;
  toggleBlock: (fold: boolean, start: number) => void;
  scrollToIndex?: number[];
  searchTerm: string;
  onRefDefClick: (item: TokenInfoItem, filePath: string) => void;
  width: number;
  height: number;
  pathHash: string | number;
  onMouseSelectStart: (lineNum: number, charNum: number) => void;
  onMouseSelectEnd: (lineNum: number, charNum: number) => void;
};

const CodeContainerVirtualized = ({
  tokens,
  foldableRanges,
  foldedLines,
  blameLines,
  metadata,
  toggleBlock,
  scrollToIndex,
  searchTerm,
  language,
  repoName,
  relativePath,
  repoPath,
  onRefDefClick,
  width,
  height,
  pathHash,
  onMouseSelectStart,
  onMouseSelectEnd,
}: Props) => {
  const ref = useRef<FixedSizeList>(null);
  const listProps = useMemo(
    () => ({
      width,
      height,
      itemSize: 20,
      itemCount: tokens.length,
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
      {({ index, style }) => (
        <CodeLine
          key={pathHash + '-' + index.toString()}
          lineNumber={index}
          lineFoldable={!!foldableRanges[index]}
          handleFold={toggleBlock}
          showLineNumbers={true}
          lineHidden={!!foldedLines[index]}
          blameLine={blameLines[index]}
          blame={!!metadata.blame?.length}
          hoverEffect
          onMouseSelectStart={onMouseSelectStart}
          onMouseSelectEnd={onMouseSelectEnd}
          shouldHighlight={
            !!scrollToIndex &&
            index >= scrollToIndex[0] &&
            index <= scrollToIndex[1]
          }
          searchTerm={searchTerm}
          stylesGenerated={style}
        >
          {tokens[index].map((token, i) => (
            <Token
              key={`cell-${index}-${i}`}
              lineHoverRanges={metadata.hoverableRanges[index]}
              language={language}
              token={token}
              repoName={repoName}
              relativePath={relativePath}
              repoPath={repoPath}
              onRefDefClick={onRefDefClick}
            />
          ))}
        </CodeLine>
      )}
    </FixedSizeList>
  );
};

export default memo(CodeContainerVirtualized, propsAreShallowEqual);
