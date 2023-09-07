import React, {
  Dispatch,
  memo,
  MutableRefObject,
  SetStateAction,
  useCallback,
  useMemo,
} from 'react';
import { Token as TokenType } from '../../../types/prism';
import { hashCode, mergeRanges } from '../../../utils';
import CodeContainerFull from './CodeContainerFull';

type Props = {
  width: number;
  height: number;
  relativePath: string;
  tokens: TokenType[][];
  searchTerm: string;
  scrollToIndex?: number[];
  currentSelection: [number, number][];
  setCurrentSelection: Dispatch<SetStateAction<[number, number][]>>;
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>;
};

const CodeContainerSelectable = ({
  tokens,
  setCurrentSelection,
  relativePath,
  ...otherProps
}: Props) => {
  const pathHash = useMemo(
    () => (relativePath ? hashCode(relativePath) : ''),
    [relativePath],
  ); // To tell if code has changed

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

  return (
    <CodeContainerFull
      pathHash={pathHash}
      tokens={tokens}
      updateRange={updateRange}
      deleteRange={deleteRange}
      invertRanges={invertRanges}
      onNewRange={onNewRange}
      {...otherProps}
    />
  );
};

export default memo(CodeContainerSelectable);
