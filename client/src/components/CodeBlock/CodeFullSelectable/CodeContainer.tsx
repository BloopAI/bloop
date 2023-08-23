import React, {
  Dispatch,
  memo,
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
  currentSelection: ([number, number] | [number])[];
  setCurrentSelection: Dispatch<
    SetStateAction<([number, number] | [number])[]>
  >;
};

const CodeContainer = ({
  tokens,
  setCurrentSelection,
  relativePath,
  ...otherProps
}: Props) => {
  const pathHash = useMemo(
    () => (relativePath ? hashCode(relativePath) : ''),
    [relativePath],
  ); // To tell if code has changed

  const onMouseSelectStart = useCallback((lineNum: number) => {
    setCurrentSelection((prev) => {
      return [...prev, [lineNum]];
    });
  }, []);

  const onMouseSelectEnd = useCallback((lineNum: number) => {
    setCurrentSelection((prev) => {
      if (!prev.length) {
        return [];
      }
      const newSelection = JSON.parse(JSON.stringify(prev));
      const current = newSelection.pop();
      if (current.length === 2) {
        return prev;
      }
      const startsAtTop = current[0] <= lineNum;
      const newRanges = [
        ...newSelection,
        startsAtTop ? [current[0], lineNum] : [lineNum, current[0]],
      ];

      return mergeRanges(newRanges);
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

  return (
    <CodeContainerFull
      pathHash={pathHash}
      onMouseSelectStart={onMouseSelectStart}
      onMouseSelectEnd={onMouseSelectEnd}
      tokens={tokens}
      updateRange={updateRange}
      deleteRange={deleteRange}
      {...otherProps}
    />
  );
};

export default memo(CodeContainer);
