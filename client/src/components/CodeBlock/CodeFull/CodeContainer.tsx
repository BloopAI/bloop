import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { SearchContext } from '../../../context/searchContext';
import { Token as TokenType } from '../../../types/prism';
import { hashCode, propsAreShallowEqual } from '../../../utils';
import { Range, TokenInfoType, TokenInfoWrapped } from '../../../types/results';
import { getTokenInfo } from '../../../services/api';
import { MAX_LINES_BEFORE_VIRTUALIZE } from '../../../consts/code';
import { mapTokenInfo } from '../../../mappers/results';
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
  highlightColor?: string | null;
  onRefDefClick: (
    lineNum: number,
    filePath: string,
    type: TokenInfoType,
  ) => void;
  width: number;
  height: number;
};

const CodeContainer = ({
  tokens,
  setCurrentSelection,
  relativePath,
  repoName,
  repoPath,
  onRefDefClick,
  language,
  ...otherProps
}: Props) => {
  const [tokenInfo, setTokenInfo] = useState<TokenInfoWrapped>({
    data: { references: [], definitions: [] },
    hoverableRange: null,
    tokenRange: null,
    isLoading: false,
    lineNumber: -1,
  });
  const { selectedBranch } = useContext(SearchContext);

  const getHoverableContent = useCallback(
    (hoverableRange: Range, tokenRange: Range, lineNumber?: number) => {
      if (hoverableRange && relativePath) {
        setTokenInfo({
          data: { references: [], definitions: [] },
          hoverableRange,
          tokenRange,
          lineNumber,
          isLoading: true,
        });
        getTokenInfo(
          relativePath,
          repoPath,
          hoverableRange.start,
          hoverableRange.end,
          selectedBranch ? selectedBranch : undefined,
        )
          .then((data) => {
            setTokenInfo({
              data: mapTokenInfo(data.data),
              hoverableRange,
              tokenRange,
              lineNumber,
              isLoading: false,
            });
          })
          .catch(() => {
            setTokenInfo({
              data: { references: [], definitions: [] },
              hoverableRange,
              tokenRange,
              lineNumber,
              isLoading: false,
            });
          });
      }
    },
    [relativePath, selectedBranch],
  );

  const handleRefsDefsClick = useCallback(
    (lineNum: number, filePath: string, type: TokenInfoType) => {
      setTokenInfo({
        data: { references: [], definitions: [] },
        hoverableRange: null,
        tokenRange: null,
        isLoading: false,
        lineNumber: -1,
      });
      onRefDefClick(lineNum, filePath, type);
    },
    [onRefDefClick],
  );

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

  return tokens.length > MAX_LINES_BEFORE_VIRTUALIZE ? (
    <CodeContainerVirtualized
      pathHash={pathHash}
      onMouseSelectStart={onMouseSelectStart}
      onMouseSelectEnd={onMouseSelectEnd}
      tokens={tokens}
      getHoverableContent={getHoverableContent}
      tokenInfo={tokenInfo}
      handleRefsDefsClick={handleRefsDefsClick}
      repoName={repoName}
      language={language}
      relativePath={relativePath}
      {...otherProps}
    />
  ) : (
    <CodeContainerFull
      pathHash={pathHash}
      onMouseSelectStart={onMouseSelectStart}
      onMouseSelectEnd={onMouseSelectEnd}
      tokens={tokens}
      getHoverableContent={getHoverableContent}
      tokenInfo={tokenInfo}
      handleRefsDefsClick={handleRefsDefsClick}
      repoName={repoName}
      language={language}
      relativePath={relativePath}
      {...otherProps}
    />
  );
};

export default memo(CodeContainer, propsAreShallowEqual);
