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

  return (
    <CodeContainerFull
      pathHash={pathHash}
      tokens={tokens}
      updateRange={updateRange}
      deleteRange={deleteRange}
      onNewRange={onNewRange}
      {...otherProps}
    />
  );
};

export default memo(CodeContainer);
