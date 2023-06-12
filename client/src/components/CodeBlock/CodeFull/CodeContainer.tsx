import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useMemo,
} from 'react';
import { Token as TokenType } from '../../../types/prism';
import { hashCode, propsAreShallowEqual } from '../../../utils';
import { TokenInfoItem } from '../../../types/results';
import CodeContainerVirtualized from './CodeContainerVirtualized';
import CodeContainerFull from './CodeContainerFull';
import { Metadata, BlameLine } from './index';

type Props = {
  language: string;
  metadata: Metadata;
  relativePath: string;
  repoPath: string;
  repoName: string;
  tokens: TokenType[][];
  foldableRanges: Record<number, number>;
  foldedLines: Record<number, number>;
  blameLines: Record<number, BlameLine>;
  toggleBlock: (fold: boolean, start: number) => void;
  setCurrentSelection: Dispatch<
    SetStateAction<
      [[number, number], [number, number]] | [[number, number]] | []
    >
  >;
  scrollToIndex?: number[];
  searchTerm: string;
  onRefDefClick: (item: TokenInfoItem, filePath: string) => void;
  width: number;
  height: number;
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

  const onMouseSelectStart = useCallback((lineNum: number, charNum: number) => {
    setCurrentSelection([[lineNum, charNum]]);
  }, []);

  const onMouseSelectEnd = useCallback((lineNum: number, charNum: number) => {
    setCurrentSelection((prev) => {
      if (!prev[0] || (prev[0][0] === lineNum && prev[0][1] === charNum)) {
        return [];
      }
      const startsAtTop =
        prev[0][0] <= lineNum ||
        (prev[0][0] === lineNum && prev[0][1] < charNum);

      return startsAtTop
        ? [prev[0], [lineNum, charNum]]
        : [[lineNum, charNum], prev[0]];
    });
  }, []);

  return tokens.length > 5000 ? (
    <CodeContainerVirtualized
      pathHash={pathHash}
      onMouseSelectStart={onMouseSelectStart}
      onMouseSelectEnd={onMouseSelectEnd}
      tokens={tokens}
      relativePath={relativePath}
      {...otherProps}
    />
  ) : (
    <CodeContainerFull
      pathHash={pathHash}
      onMouseSelectStart={onMouseSelectStart}
      onMouseSelectEnd={onMouseSelectEnd}
      tokens={tokens}
      relativePath={relativePath}
      {...otherProps}
    />
  );
};

export default memo(CodeContainer, propsAreShallowEqual);
