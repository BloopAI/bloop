import React, { memo, useEffect, useRef, useState } from 'react';
import CodeLine from '../Code/CodeLine';
import { Token as TokenType } from '../../../types/prism';
import { propsAreShallowEqual } from '../../../utils';
import { Range, TokenInfoType, TokenInfoWrapped } from '../../../types/results';
import RefsDefsPopup from '../../TooltipCode/RefsDefsPopup';
import { useOnClickOutside } from '../../../hooks/useOnClickOutsideHook';
import { findElementInCurrentTab } from '../../../utils/domUtils';
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
  highlightColor?: string | null;
  pathHash: string | number;
  onMouseSelectStart: (lineNum: number, charNum: number) => void;
  onMouseSelectEnd: (lineNum: number, charNum: number) => void;
  getHoverableContent: (hoverableRange: Range, tokenRange: Range) => void;
  tokenInfo: TokenInfoWrapped;
  handleRefsDefsClick: (
    lineNum: number,
    filePath: string,
    type: TokenInfoType,
    tokenName: string,
    tokenRange: string,
  ) => void;
  relativePath: string;
};

const CodeContainerFull = ({
  language,
  tokens,
  foldableRanges,
  foldedLines,
  blameLines,
  metadata,
  toggleBlock,
  scrollToIndex,
  highlightColor,
  searchTerm,
  getHoverableContent,
  pathHash,
  onMouseSelectStart,
  onMouseSelectEnd,
  tokenInfo,
  repoName,
  handleRefsDefsClick,
  relativePath,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [isPopupVisible, setPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  useOnClickOutside(popupRef, () => setPopupVisible(false));

  useEffect(() => {
    if (tokenInfo.tokenRange) {
      let tokenElem = findElementInCurrentTab(
        `.code-modal-container [data-byte-range="${tokenInfo.tokenRange.start}-${tokenInfo.tokenRange.end}"]`,
      );
      if (!tokenElem) {
        tokenElem = findElementInCurrentTab(
          `#result-full-code-container [data-byte-range="${tokenInfo.tokenRange.start}-${tokenInfo.tokenRange.end}"]`,
        );
      }
      if (tokenElem && tokenElem instanceof HTMLElement) {
        setPopupPosition({
          top: tokenElem.offsetTop + 10,
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
      line?.scrollIntoView({ behavior: 'smooth', block: align });
    }
  }, [scrollToIndex, tokens.length]);

  return (
    <div ref={ref} className="relative pb-44">
      {tokens.map((line, index) => (
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
          highlightColor={highlightColor}
          searchTerm={searchTerm}
        >
          {line.map((token, i) => (
            <Token
              key={`cell-${index}-${i}`}
              lineHoverRanges={metadata.hoverableRanges[index]}
              token={token}
              getHoverableContent={getHoverableContent}
            />
          ))}
        </CodeLine>
      ))}
      {!!popupPosition && isPopupVisible && (
        <div className="absolute max-w-sm" style={popupPosition} ref={popupRef}>
          <RefsDefsPopup
            placement={popupPosition.right ? 'bottom-end' : 'bottom-start'}
            data={tokenInfo}
            repoName={repoName}
            onRefDefClick={handleRefsDefsClick}
            language={language}
            relativePath={relativePath}
          />
        </div>
      )}
    </div>
  );
};

export default memo(CodeContainerFull, propsAreShallowEqual);
