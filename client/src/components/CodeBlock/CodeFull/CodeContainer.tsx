import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { SearchContext } from '../../../old_stuff/context/searchContext';
import { Token as TokenType } from '../../../types/prism';
import { hashCode } from '../../../utils';
import { Range, TokenInfoType, TokenInfoWrapped } from '../../../types/results';
import { getTokenInfo } from '../../../services/api';
import { MAX_LINES_BEFORE_VIRTUALIZE } from '../../../consts/code';
import { mapTokenInfo } from '../../../mappers/results';
import { AppNavigationContext } from '../../../old_stuff/context/appNavigationContext';
import { FileHighlightsContext } from '../../../context/fileHighlightsContext';
import CodeContainerVirtualized from './CodeContainerVirtualized';
import CodeContainerFull from './CodeContainerFull';
import { Metadata, BlameLine } from './index';

type Props = {
  language: string;
  metadata?: Metadata;
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
    tokenName: string,
    tokenRange: string,
  ) => void;
  width: number;
  height: number;
  isDiff?: boolean;
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
  const { selectedBranch } = useContext(SearchContext.SelectedBranch);
  const { navigatedItem } = useContext(AppNavigationContext);
  const { fileHighlights, hoveredLines } = useContext(
    FileHighlightsContext.Values,
  );

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
              data: mapTokenInfo(data.data, relativePath),
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

  useEffect(() => {
    if (navigatedItem?.pathParams?.tokenRange) {
      const [start, end] = navigatedItem?.pathParams?.tokenRange
        .split('_')
        .map((l) => Number(l));
      getHoverableContent({ start, end }, { start, end });
    }
  }, [navigatedItem?.pathParams?.tokenRange, getHoverableContent]);

  const handleRefsDefsClick = useCallback(
    (
      lineNum: number,
      filePath: string,
      type: TokenInfoType,
      tokenName: string,
      tokenRange: string,
    ) => {
      setTokenInfo({
        data: { references: [], definitions: [] },
        hoverableRange: null,
        tokenRange: null,
        isLoading: false,
        lineNumber: -1,
      });
      onRefDefClick(lineNum, filePath, type, tokenName, tokenRange);
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
      highlights={fileHighlights[relativePath]}
      hoveredLines={hoveredLines}
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
      highlights={fileHighlights[relativePath]}
      hoveredLines={hoveredLines}
      {...otherProps}
    />
  );
};

export default memo(CodeContainer);
