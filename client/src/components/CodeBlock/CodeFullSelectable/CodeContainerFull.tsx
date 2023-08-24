import React, {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Token as TokenType } from '../../../types/prism';
import { findElementInCurrentTab } from '../../../utils/domUtils';
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
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [currentlySelectingRange, setCurrentlySelectingRange] = useState<
    null | [number, number]
  >(null);
  const [modifyingRange, setModifyingRange] = useState(-1);

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
