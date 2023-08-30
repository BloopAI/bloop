import React, {
  Fragment,
  memo,
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Token as TokenType } from '../../../types/prism';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import { CODE_LINE_HEIGHT } from '../../../consts/code';
import CodeLine from './CodeLine';
import SelectionHandler from './SelectionHandler';
import SelectionRect from './SelectionRect';

type Props = {
  tokens: TokenType[][];
  searchTerm: string;
  pathHash: string | number;
  scrollToIndex?: number[];
  currentSelection: [number, number][];
  updateRange: (i: number, newRange: [number, number]) => void;
  deleteRange: (i: number) => void;
  onNewRange: (r: [number, number]) => void;
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>;
};

const CodeContainerFull = ({
  tokens,
  searchTerm,
  pathHash,
  scrollToIndex,
  currentSelection,
  updateRange,
  deleteRange,
  onNewRange,
  scrollContainerRef,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [currentlySelectingRange, setCurrentlySelectingRange] = useState<
    null | [number, number]
  >(null);
  const [modifyingRange, setModifyingRange] = useState(-1);
  const [shouldScroll, setShouldScroll] = useState<'top' | 'bottom' | false>(
    false,
  );

  useEffect(() => {
    if (scrollToIndex && ref.current) {
      let scrollToItem = scrollToIndex[0];
      scrollToItem = Math.max(0, Math.min(scrollToItem, tokens.length - 1));
      const line = findElementInCurrentTab(
        `[data-line-number="${scrollToItem}"]`,
      );
      line?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [scrollToIndex, tokens.length]);

  useEffect(() => {
    const scrollingFunc = () => {
      if (scrollContainerRef.current && shouldScroll) {
        scrollContainerRef.current.scroll({
          top:
            scrollContainerRef.current?.scrollTop +
            (shouldScroll === 'top' ? -CODE_LINE_HEIGHT : CODE_LINE_HEIGHT),
        });
      }
    };
    let intervalId: number;
    if (shouldScroll) {
      intervalId = window.setInterval(scrollingFunc, 200);
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

  const lines = useMemo(() => {
    return tokens.map((line, index) => {
      return (
        <CodeLine
          key={pathHash + '-' + index.toString()}
          lineNumber={index}
          handleAddRange={handleAddRange}
          searchTerm={searchTerm}
          setCurrentlySelectingRange={setCurrentlySelectingRange}
          isSelectionDisabled={modifyingRange > -1}
          fileLinesNum={tokens.length}
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
    });
  }, [tokens, pathHash, searchTerm, modifyingRange, handleAddRange]);

  return (
    <div ref={ref} className="relative pb-60">
      {currentSelection.map((r, i) => (
        <Fragment key={i}>
          <SelectionHandler
            initialRange={r}
            updateRange={updateRange}
            setCurrentlySelectingRange={setCurrentlySelectingRange}
            deleteRange={deleteRange}
            i={i}
            setModifyingRange={setModifyingRange}
            fileLinesNum={tokens.length}
          />
          <SelectionRect range={r} i={i} deleteRange={deleteRange} />
        </Fragment>
      ))}
      {!!currentlySelectingRange && (
        <SelectionRect range={currentlySelectingRange} isTemporary />
      )}
      {lines}
    </div>
  );
};

export default memo(CodeContainerFull);
