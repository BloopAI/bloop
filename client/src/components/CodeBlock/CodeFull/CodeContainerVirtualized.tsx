import { Align, FixedSizeList } from 'react-window';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import CodeLine from '../Code/CodeLine';
import { Token as TokenType } from '../../../types/prism';
import { propsAreShallowEqual } from '../../../utils';
import { Range, TokenInfoItem, TokenInfoWrapped } from '../../../types/results';
import { getOffsetForIndexAndAlignment } from '../../../utils/scrollUtils';
import RefsDefsPopup from '../../TooltipCode/RefsDefsPopup';
import { useOnClickOutside } from '../../../hooks/useOnClickOutsideHook';
import Token from './Token';
import { Metadata, BlameLine } from './index';

type Props = {
  language: string;
  metadata: Metadata;
  repoName: string;
  tokens: TokenType[][];
  foldableRanges: Record<number, number>;
  foldedLines: Record<number, number>;
  blameLines: Record<number, BlameLine>;
  toggleBlock: (fold: boolean, start: number) => void;
  scrollToIndex?: number[];
  searchTerm: string;
  width: number;
  height: number;
  pathHash: string | number;
  onMouseSelectStart: (lineNum: number, charNum: number) => void;
  getHoverableContent: (range: Range, lineNumber: number) => void;
  onMouseSelectEnd: (lineNum: number, charNum: number) => void;
  tokenInfo: TokenInfoWrapped;
  handleRefsDefsClick: (item: TokenInfoItem, filePath: string) => void;
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
  width,
  height,
  pathHash,
  onMouseSelectStart,
  onMouseSelectEnd,
  getHoverableContent,
  handleRefsDefsClick,
  tokenInfo,
  repoName,
  language,
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
  const popupRef = useRef<HTMLDivElement>(null);
  const [isPopupVisible, setPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  useOnClickOutside(popupRef, () => setPopupVisible(false));

  useEffect(() => {
    if (tokenInfo.byteRange) {
      const tokenElem = document.querySelector(
        `[data-byte-range="${tokenInfo.byteRange.start}-${tokenInfo.byteRange.end}"]`,
      );
      if (tokenElem && tokenElem instanceof HTMLElement) {
        setPopupPosition({
          top: 10,
          ...(tokenElem.offsetLeft > tokenElem.offsetParent!.scrollWidth / 2
            ? {
                right:
                  tokenElem.offsetParent!.clientWidth -
                  (tokenElem.offsetLeft + tokenElem.offsetWidth),
              }
            : { left: tokenElem.offsetLeft }),
        });
        setPopupVisible(true);
      }
    }
  }, [tokenInfo]);

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
              token={token}
              getHoverableContent={(range) => getHoverableContent(range, index)}
            />
          ))}
          {!!popupPosition &&
            isPopupVisible &&
            index === tokenInfo.lineNumber && (
              <div
                className="absolute max-w-sm"
                style={popupPosition}
                ref={popupRef}
              >
                <RefsDefsPopup
                  placement={
                    popupPosition.right ? 'bottom-end' : 'bottom-start'
                  }
                  data={tokenInfo}
                  repoName={repoName}
                  onRefDefClick={handleRefsDefsClick}
                  language={language}
                />
              </div>
            )}
        </CodeLine>
      )}
    </FixedSizeList>
  );
};

export default memo(CodeContainerVirtualized, propsAreShallowEqual);
