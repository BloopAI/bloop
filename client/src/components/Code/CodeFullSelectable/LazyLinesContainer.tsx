import React, {
  Dispatch,
  memo,
  SetStateAction,
  useEffect,
  useState,
} from 'react';
import { Token as TokenType } from '../../../types/prism';
import CodeLine from '../CodeLine';
import { Range } from '../../../types/results';
import { useDiffLines } from '../../../hooks/useDiffLines';
import Token from '../CodeFull/Token';

type Props = {
  items: TokenType[][];
  pathHash: string | number;
  searchTerm: string;
  modifyingRange: number;
  handleAddRange: () => void;
  setCurrentlySelectingRange: Dispatch<SetStateAction<null | [number, number]>>;
  scrollToIndex?: number[];
  hoverableRanges?: Record<number, Range[]>;
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
  isEditingRanges?: boolean;
};

const LazyLinesContainer = ({
  items,
  pathHash,
  searchTerm,
  modifyingRange,
  handleAddRange,
  setCurrentlySelectingRange,
  scrollToIndex,
  hoverableRanges,
  hoveredLines,
  getHoverableContent,
  highlights,
  isDiff,
  isEditingRanges,
}: Props) => {
  const [renderedItems, setRenderedItems] = useState<TokenType[][]>(
    items.length > 300 ? [] : items,
  );
  const [showAllItems, setShowAllItems] = useState(false);
  const { lineNumbersAdd, lineNumbersRemove } = useDiffLines(items, !isDiff);

  useEffect(() => {
    let animationFrameId: number;
    if (items.length > 300) {
      // Simulate a delay before showing all items
      const delay = 500; // Adjust the delay as needed
      let startTime: number;

      const animateItems = (timestamp: number) => {
        if (!startTime) {
          startTime = timestamp;
        }

        const progress = timestamp - startTime;
        const itemsToShow = Math.min(
          Math.floor((progress / delay) * items.length),
          items.length,
        );

        setRenderedItems(items.slice(0, itemsToShow));

        if (itemsToShow < items.length) {
          requestAnimationFrame(animateItems);
        } else {
          setShowAllItems(true);
        }
      };

      animationFrameId = requestAnimationFrame(animateItems);
    }
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [items]);

  return (
    <>
      {renderedItems.map((line, index) => {
        let highlightForLine = highlights?.findIndex(
          (h) => h && index >= h.lines[0] && index <= h.lines[1],
        );
        if (highlightForLine && highlightForLine < 0) {
          highlightForLine = undefined;
        }
        return (
          <CodeLine
            key={pathHash + '-' + index.toString()}
            lineNumber={index}
            handleAddRange={handleAddRange}
            searchTerm={searchTerm}
            setCurrentlySelectingRange={setCurrentlySelectingRange}
            isSelectionDisabled={modifyingRange > -1}
            fileLinesNum={items.length}
            showLineNumbers
            hoverEffect
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
              isDiff && (line[0]?.content === '+' || line[1]?.content === '+')
            }
            isRemovedLine={
              isDiff && (line[0]?.content === '-' || line[1]?.content === '-')
            }
            lineNumbersDiff={
              isDiff ? [lineNumbersRemove[index], lineNumbersAdd[index]] : null
            }
            isEditingRanges={isEditingRanges}
          >
            {line.map((token, i) => (
              <Token
                key={`cell-${index}-${i}`}
                lineHoverRanges={hoverableRanges?.[index]}
                token={token}
                getHoverableContent={getHoverableContent}
                lineNumber={index}
                isEditingRanges={isEditingRanges}
              />
            ))}
          </CodeLine>
        );
      })}
    </>
  );
};

export default memo(LazyLinesContainer);
