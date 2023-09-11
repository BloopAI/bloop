import React, {
  Dispatch,
  memo,
  SetStateAction,
  useEffect,
  useState,
} from 'react';
import { Token as TokenType } from '../../../types/prism';
import CodeLine from './CodeLine';

type Props = {
  items: TokenType[][];
  pathHash: string | number;
  searchTerm: string;
  modifyingRange: number;
  handleAddRange: () => void;
  setCurrentlySelectingRange: Dispatch<SetStateAction<null | [number, number]>>;
  scrollToIndex?: number[];
};

const LazyLinesContainer = ({
  items,
  pathHash,
  searchTerm,
  modifyingRange,
  handleAddRange,
  setCurrentlySelectingRange,
  scrollToIndex,
}: Props) => {
  const [renderedItems, setRenderedItems] = useState<TokenType[][]>(
    items.length > 300 ? [] : items,
  );
  const [showAllItems, setShowAllItems] = useState(false);

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
        return (
          <CodeLine
            key={pathHash + '-' + index.toString()}
            lineNumber={index}
            handleAddRange={handleAddRange}
            searchTerm={searchTerm}
            setCurrentlySelectingRange={setCurrentlySelectingRange}
            isSelectionDisabled={modifyingRange > -1}
            fileLinesNum={items.length}
            shouldHighlight={
              !!scrollToIndex &&
              index >= scrollToIndex[0] &&
              index <= scrollToIndex[1]
            }
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
    </>
  );
};

export default memo(LazyLinesContainer);
