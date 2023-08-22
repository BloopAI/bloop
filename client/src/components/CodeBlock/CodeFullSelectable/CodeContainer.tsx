import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useMemo,
} from 'react';
import { Token as TokenType } from '../../../types/prism';
import { hashCode } from '../../../utils';
import { MAX_LINES_BEFORE_VIRTUALIZE } from '../../../consts/code';
import CodeContainerVirtualized from './CodeContainerVirtualized';
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
      const startsAtTop = current[0] <= lineNum;

      return [
        ...newSelection,
        startsAtTop ? [current[0], lineNum] : [lineNum, current[0]],
      ];
    });
  }, []);

  return tokens.length > MAX_LINES_BEFORE_VIRTUALIZE ? (
    <CodeContainerVirtualized
      pathHash={pathHash}
      onMouseSelectStart={onMouseSelectStart}
      onMouseSelectEnd={onMouseSelectEnd}
      tokens={tokens}
      {...otherProps}
    />
  ) : (
    <CodeContainerFull
      pathHash={pathHash}
      onMouseSelectStart={onMouseSelectStart}
      onMouseSelectEnd={onMouseSelectEnd}
      tokens={tokens}
      {...otherProps}
    />
  );
};

export default memo(CodeContainer);
