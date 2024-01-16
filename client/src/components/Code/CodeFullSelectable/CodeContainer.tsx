import React, {
  Dispatch,
  Fragment,
  memo,
  MutableRefObject,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Token as TokenType } from '../../../types/prism';
import { hashCode, mergeRanges } from '../../../utils';
import {
  findElementInCurrentTab,
  isFocusInInput,
} from '../../../utils/domUtils';
import { CODE_LINE_HEIGHT } from '../../../consts/code';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { Range } from '../../../types/results';
import { useDiffLines } from '../../../hooks/useDiffLines';
import SelectionHandler from './SelectionHandler';
import SelectionRect from './SelectionRect';
import LinesContainer from './LazyLinesContainer';

type Props = {
  relativePath: string;
  tokens: TokenType[][];
  searchTerm: string;
  scrollToIndex?: number[];
  currentSelection: [number, number][];
  setCurrentSelection: Dispatch<SetStateAction<[number, number][]>>;
  scrollContainerRef: MutableRefObject<HTMLPreElement | null>;
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

const CodeContainerSelectable = ({
  tokens,
  setCurrentSelection,
  relativePath,
  searchTerm,
  scrollToIndex,
  currentSelection,
  scrollContainerRef,
  getHoverableContent,
  hoverableRanges,
  hoveredLines,
  isDiff,
  highlights,
  isEditingRanges,
}: Props) => {
  const { lineNumbersAdd, lineNumbersRemove } = useDiffLines(tokens, !isDiff);
  const pathHash = useMemo(
    () => (relativePath ? hashCode(relativePath) : ''),
    [relativePath],
  ); // To tell if code has changed
  const ref = useRef<HTMLDivElement>(null);
  const [currentlySelectingRange, setCurrentlySelectingRange] = useState<
    null | [number, number]
  >(null);
  const [modifyingRange, setModifyingRange] = useState(-1);
  const [shouldScroll, setShouldScroll] = useState<'top' | 'bottom' | false>(
    false,
  );
  const [currentFocusedRange, setCurrentFocusedRange] = useState(-1);

  useEffect(() => {
    if (scrollToIndex && ref.current) {
      let scrollToItem = scrollToIndex[0];
      scrollToItem = Math.max(0, Math.min(scrollToItem, tokens.length - 1));
      const line = findElementInCurrentTab(
        `[data-active="true"][data-line-number="${scrollToItem}"]`,
      );
      line?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [scrollToIndex, tokens.length]);

  let scrollMomentum = 1;

  useEffect(() => {
    const scrollingFunc = () => {
      scrollMomentum++;
      if (scrollContainerRef.current && shouldScroll) {
        const scollMomentumSmooth = Math.floor(scrollMomentum / 4);
        scrollContainerRef.current.scroll({
          top:
            scrollContainerRef.current?.scrollTop +
            (shouldScroll === 'top'
              ? -CODE_LINE_HEIGHT * scollMomentumSmooth
              : CODE_LINE_HEIGHT * scollMomentumSmooth),
        });
      }
    };
    let intervalId: number;
    if (shouldScroll) {
      intervalId = window.setInterval(scrollingFunc, 50);
    }
    return () => {
      clearInterval(intervalId);
    };
  }, [shouldScroll]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (scrollContainerRef.current) {
        const containerBox = scrollContainerRef.current.getBoundingClientRect();
        const isAtContainerTop =
          e.clientY - CODE_LINE_HEIGHT <= containerBox.top;
        const isAtContainerBottom =
          e.clientY + CODE_LINE_HEIGHT >=
          containerBox.top + containerBox.height;
        if (isAtContainerTop || isAtContainerBottom) {
          setShouldScroll(isAtContainerTop ? 'top' : 'bottom');
        } else {
          setShouldScroll(false);
        }
      }
    };
    if (!!currentlySelectingRange) {
      document.body.addEventListener('mousemove', handleMouseMove);
    } else {
      setShouldScroll(false);
    }
    return () => {
      document.body.removeEventListener('mousemove', handleMouseMove);
    };
  }, [!!currentlySelectingRange]);

  const handleAddRange = useCallback(() => {
    setCurrentlySelectingRange((prev) => {
      if (prev) {
        onNewRange(prev);
      }
      return null;
    });
  }, []);

  const onNewRange = useCallback((range: [number, number]) => {
    setCurrentSelection((prev) => {
      const newRanges = JSON.parse(JSON.stringify(prev));
      return mergeRanges([...newRanges, range]);
    });
  }, []);

  const updateRange = useCallback((i: number, newRange: [number, number]) => {
    setCurrentSelection((prev) => {
      const newRanges = JSON.parse(JSON.stringify(prev));
      newRanges[i] = newRange;
      return mergeRanges(newRanges);
    });
  }, []);

  const deleteRange = useCallback((i: number) => {
    setCurrentSelection((prev) => {
      const newRanges = JSON.parse(JSON.stringify(prev));
      newRanges.splice(i, 1);
      return mergeRanges(newRanges);
    });
  }, []);

  const invertRanges = useCallback(() => {
    setCurrentSelection((prev) => {
      const totalLines = tokens.length; // assuming tokens.length gives the total number of lines
      let newRanges: [number, number][] = [];
      let lastEnd = 0;

      // Sort the ranges by their start index
      const sortedRanges = [...prev].sort((a, b) => a[0] - b[0]);

      sortedRanges.forEach((range) => {
        // If there is a gap between the last range and this one, add it to newRanges
        if (range[0] > lastEnd) {
          newRanges.push([lastEnd, range[0] - 1]);
        }
        // Update lastEnd to be the end of this range
        lastEnd = range[1] + 1;
      });

      // If there is a gap between the last range and the end of the code, add it to newRanges
      if (lastEnd < totalLines) {
        newRanges.push([lastEnd, totalLines - 1]);
      }

      return newRanges;
    });
  }, [tokens.length]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (
        !isFocusInInput() &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        currentSelection.length > 1
      ) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          setCurrentFocusedRange((prev) => {
            const newIndex =
              e.key === 'ArrowDown'
                ? prev >= currentSelection.length - 1
                  ? 0
                  : prev + 1
                : prev <= 0
                ? currentSelection.length - 1
                : prev - 1;
            const lineNum = currentSelection[newIndex][0];
            if (lineNum > -1) {
              const line = findElementInCurrentTab(
                `[data-line-number="${lineNum}"]`,
              );
              line?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }
            return newIndex;
          });
        }
      }
    },
    [currentSelection],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <div ref={ref} className="relative pb-16 overflow-auto">
      {currentSelection.map((r, i) => (
        <Fragment key={i}>
          {isEditingRanges && (
            <SelectionHandler
              initialRange={r}
              updateRange={updateRange}
              setCurrentlySelectingRange={setCurrentlySelectingRange}
              deleteRange={deleteRange}
              i={i}
              setModifyingRange={setModifyingRange}
              fileLinesNum={tokens.length}
            />
          )}
          <SelectionRect
            range={r}
            i={i}
            deleteRange={deleteRange}
            invertRanges={invertRanges}
            isEditingRanges={isEditingRanges}
          />
        </Fragment>
      ))}
      <div className="overflow-x-auto relative">
        {!!currentlySelectingRange && (
          <SelectionRect range={currentlySelectingRange} isTemporary />
        )}
        <LinesContainer
          items={tokens}
          pathHash={pathHash}
          handleAddRange={handleAddRange}
          searchTerm={searchTerm}
          setCurrentlySelectingRange={setCurrentlySelectingRange}
          modifyingRange={modifyingRange}
          scrollToIndex={scrollToIndex}
          getHoverableContent={getHoverableContent}
          hoverableRanges={hoverableRanges}
          highlights={highlights}
          hoveredLines={hoveredLines}
          isDiff={isDiff}
          isEditingRanges={isEditingRanges}
        />
      </div>
    </div>
  );
};

export default memo(CodeContainerSelectable);
