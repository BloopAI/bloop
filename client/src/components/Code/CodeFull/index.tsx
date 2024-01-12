import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Range, TokenInfoWrapped } from '../../../types/results';
import { getPrismLanguage, tokenizeCode } from '../../../utils/prism';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import { getTokenInfo } from '../../../services/api';
import { mapTokenInfo } from '../../../mappers/results';
import { TabsContext } from '../../../context/tabsContext';
import { TabTypesEnum } from '../../../types/general';
import { useOnClickOutside } from '../../../hooks/useOnClickOutsideHook';
import RefsDefsPopup from '../../RefsDefsPopup';
import { copyToClipboard, getSelectionLines } from '../../../utils';
import SearchOnPage from '../../SearchOnPage';
import { useCodeSearch } from '../../../hooks/useCodeSearch';
import SelectionPopup from './SelectionPopup';
import VirtualizedCode from './VirtualizedCode';

type Props = {
  code: string;
  language: string;
  hoverableRanges?: Record<number, Range[]>;
  relativePath: string;
  repoRef: string;
  isDiff?: boolean;
  scrollToLine?: string;
  branch?: string | null;
  tokenRange?: string;
  highlights?: (
    | { lines: [number, number]; color: string; index: number }
    | undefined
  )[];
  hoveredLines?: [number, number] | null;
  side: 'left' | 'right';
  width: number;
  height: number;
  isSearchDisabled?: boolean;
};

const CodeFull = ({
  code,
  isDiff,
  hoverableRanges,
  repoRef,
  relativePath,
  branch,
  language,
  scrollToLine,
  tokenRange,
  highlights,
  hoveredLines,
  side,
  width,
  height,
  isSearchDisabled,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);
  const [tokenInfo, setTokenInfo] = useState<TokenInfoWrapped>({
    data: { references: [], definitions: [] },
    hoverableRange: null,
    tokenRange: null,
    isLoading: false,
    lineNumber: -1,
  });
  const popupRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  const [isPopupVisible, setPopupVisible] = useState(false);
  const [selectionPopupData, setSelectionPopupData] = useState<{
    selectedLines: [number, number];
  } | null>(null);
  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  useOnClickOutside(popupRef, () => setPopupVisible(false));
  const scrollLineNumber = useMemo(
    () =>
      scrollToLine?.split('_').map((s) => Number(s)) as
        | [number, number]
        | undefined,
    [scrollToLine],
  );
  const [scrollToIndex, setScrollToIndex] = useState(
    scrollLineNumber || undefined,
  );
  useEffect(() => {
    setScrollToIndex(scrollLineNumber || undefined);
  }, [scrollLineNumber]);

  const {
    handleSearchCancel,
    isSearchActive,
    setSearchTerm,
    searchTerm,
    searchResults,
    setCurrentResult,
    currentResult,
    deferredSearchTerm,
  } = useCodeSearch({
    code,
    setScrollToIndex,
    isDisabled: isSearchDisabled,
  });

  const lang = useMemo(
    () => getPrismLanguage(language) || 'plaintext',
    [language],
  );
  const tokens = useMemo(() => tokenizeCode(code, lang), [code, lang]);

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
          repoRef,
          hoverableRange.start,
          hoverableRange.end,
          branch ? branch : undefined,
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
    [relativePath, branch],
  );

  useEffect(() => {
    if (tokenRange) {
      const [start, end] = tokenRange.split('_').map((l) => Number(l));
      getHoverableContent({ start, end }, { start, end });
    }
  }, [tokenRange, getHoverableContent]);

  const handleRefsDefsClick = useCallback(
    (lineNum: number, filePath: string, tokenRange: string) => {
      setTokenInfo({
        data: { references: [], definitions: [] },
        hoverableRange: null,
        tokenRange: null,
        isLoading: false,
        lineNumber: -1,
      });
      openNewTab({
        type: TabTypesEnum.FILE,
        path: filePath,
        repoRef,
        branch,
        scrollToLine: `${lineNum}_${lineNum}`,
        tokenRange,
      });
    },
    [openNewTab, repoRef, branch],
  );
  useEffect(() => {
    if (tokenInfo.tokenRange) {
      let tokenElem = findElementInCurrentTab(
        `[data-byte-range="${tokenInfo.tokenRange.start}-${tokenInfo.tokenRange.end}"]`,
      );
      if (tokenElem && tokenElem instanceof HTMLElement) {
        const box = tokenElem.getBoundingClientRect();
        setPopupPosition({
          top: box.top - 72 + 10,
          ...(tokenElem.offsetLeft > tokenElem.offsetParent!.scrollWidth / 2
            ? {
                right:
                  tokenElem.offsetParent!.clientWidth -
                  (tokenElem.offsetLeft + tokenElem.offsetWidth),
              }
            : { left: tokenElem.offsetLeft + 12 }),
        });
        setPopupVisible(true);
      }
    } else {
      setPopupPosition(null);
    }
  }, [tokenInfo]);

  useEffect(() => {
    setPopupPosition(null);
  }, []);

  useEffect(() => {
    let startLine: number | null;
    const handleWindowMouseDown = (e: MouseEvent) => {
      if (e.target) {
        startLine = getSelectionLines(e.target as HTMLElement);
      }
    };
    const handleWindowMouseUp = (e: MouseEvent) => {
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection?.toString()) {
          const endLine = getSelectionLines(e.target as HTMLElement);
          if (endLine !== null && startLine !== null) {
            setSelectionPopupData({
              selectedLines: [startLine, endLine].sort((a, b) => a - b) as [
                number,
                number,
              ],
            });
          }
        } else {
          setSelectionPopupData(null);
        }
      }, 50);
    };

    const handleScroll = () => {
      setSelectionPopupData(null);
    };

    codeRef.current?.addEventListener('mousedown', handleWindowMouseDown);
    codeRef.current?.addEventListener('mouseup', handleWindowMouseUp);
    codeRef.current?.parentElement?.parentElement?.addEventListener(
      'scroll',
      handleScroll,
    );

    return () => {
      codeRef.current?.removeEventListener('mousedown', handleWindowMouseDown);
      codeRef.current?.removeEventListener('mouseup', handleWindowMouseUp);
      codeRef.current?.parentElement?.parentElement?.removeEventListener(
        'scroll',
        handleScroll,
      );
    };
  }, []);

  const closeSelectionPopup = useCallback(() => {
    setSelectionPopupData(null);
  }, []);

  const handleCopy = useCallback(
    (e: React.ClipboardEvent<HTMLPreElement>) => {
      if (selectionPopupData?.selectedLines) {
        const codeToCopy = code
          .split('\n')
          .slice(
            selectionPopupData.selectedLines[0],
            selectionPopupData.selectedLines[1],
          )
          .join('\n');
        if (codeToCopy) {
          e.preventDefault();
          copyToClipboard(codeToCopy);
        }
      }
    },
    [selectionPopupData?.selectedLines],
  );

  return (
    <div className="">
      <SearchOnPage
        handleSearch={setSearchTerm}
        isSearchActive={isSearchActive}
        resultNum={searchResults.length}
        onCancel={handleSearchCancel}
        currentResult={currentResult}
        setCurrentResult={setCurrentResult}
        searchValue={searchTerm}
        containerClassName="absolute top-2 right-2 w-80 max-w-[calc(100%-1rem)]"
      />
      <pre
        className={`prism-code language-${lang} w-full h-full code-s`}
        ref={codeRef}
        onCopy={handleCopy}
      >
        <code>
          <VirtualizedCode
            getHoverableContent={getHoverableContent}
            hoverableRanges={hoverableRanges}
            highlights={highlights}
            hoveredLines={hoveredLines}
            scrollToIndex={scrollToIndex}
            tokens={tokens}
            isDiff={isDiff}
            width={width}
            height={height}
            searchTerm={deferredSearchTerm}
          />
        </code>
      </pre>
      {!!popupPosition && isPopupVisible && (
        <div className="absolute max-w-sm" style={popupPosition} ref={popupRef}>
          <RefsDefsPopup
            placement={popupPosition.right ? 'bottom-end' : 'bottom-start'}
            data={tokenInfo}
            onRefDefClick={handleRefsDefsClick}
            language={language}
            relativePath={relativePath}
          />
        </div>
      )}
      <SelectionPopup
        closePopup={closeSelectionPopup}
        path={relativePath}
        repoRef={repoRef}
        branch={branch}
        side={side}
        selectedLines={selectionPopupData?.selectedLines}
      />
    </div>
  );
};

export default memo(CodeFull);
