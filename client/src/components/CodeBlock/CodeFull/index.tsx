import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPrismLanguage, tokenizeCode } from '../../../utils/prism';
import { Range, TokenInfoType } from '../../../types/results';
import {
  calculatePopupPositionInsideContainer,
  copyToClipboard,
} from '../../../utils';
import { Commit } from '../../../types';
import useAppNavigation from '../../../hooks/useAppNavigation';
import SearchOnPage from '../../SearchOnPage';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { MAX_LINES_BEFORE_VIRTUALIZE } from '../../../consts/code';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import CodeContainer from './CodeContainer';
import ExplainButton from './ExplainButton';

export interface BlameLine {
  start: boolean;
  commit?: Commit;
}

interface GitBlame {
  lineRange: Range;
  commit: Commit;
}

export interface Metadata {
  lexicalBlocks: Range[];
  hoverableRanges: Record<number, Range[]>;
  blame?: GitBlame[];
}

type Props = {
  code: string;
  language: string;
  metadata: Metadata;
  relativePath: string;
  repoPath: string;
  repoName: string;
  containerWidth: number;
  containerHeight: number;
  closePopup?: () => void;
};

const CodeFull = ({
  language,
  code,
  metadata,
  relativePath,
  repoPath,
  repoName,
  containerWidth,
  containerHeight,
  closePopup,
}: Props) => {
  const [foldableRanges, setFoldableRanges] = useState<Record<number, number>>(
    {},
  );
  const [searchParams] = useSearchParams();
  const [foldedLines, setFoldedLines] = useState<Record<number, number>>({});
  const [blameLines, setBlameLines] = useState<Record<number, BlameLine>>({});
  const [currentSelection, setCurrentSelection] = useState<
    [[number, number], [number, number]] | [[number, number]] | []
  >([]);
  const scrollLineNumber = useMemo(
    () =>
      (
        searchParams.get('modalScrollToLine') ||
        searchParams.get('scrollToLine')
      )
        ?.split('_')
        .map((i) => Number(i)),
    [searchParams],
  );
  const highlightColor = useMemo(
    () =>
      searchParams.get('highlightColor') ||
      searchParams.get('modalHighlightColor'),
    [searchParams],
  );
  const [scrollToIndex, setScrollToIndex] = useState(
    scrollLineNumber || undefined,
  );
  const ref = useRef<HTMLPreElement>(null);

  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const { navigateFullResult } = useAppNavigation();

  const [isSearchActive, setSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentResult, setCurrentResult] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    const toggleSearch = (e: KeyboardEvent) => {
      if (e.code === 'KeyF' && e.metaKey) {
        e.preventDefault();
        setSearchActive((prev) => !prev);
        return false;
      } else if (e.code === 'Enter') {
        const isNext = !e.shiftKey;
        setCurrentResult((prev) =>
          isNext
            ? prev < searchResults.length
              ? prev + 1
              : 1
            : prev > 1
            ? prev - 1
            : searchResults.length,
        );
      } else if (e.code === 'Escape') {
        setSearchActive((prev) => {
          if (prev) {
            e.preventDefault();
          }
          return false;
        });
        setScrollToIndex(undefined);
        setSearchTerm('');
      }
    };
    window.addEventListener('keydown', toggleSearch);

    return () => {
      window.removeEventListener('keydown', toggleSearch);
    };
  }, [searchResults]);

  useEffect(() => {
    setScrollToIndex(scrollLineNumber || undefined);
  }, [scrollLineNumber]);

  const lang = useMemo(
    () => getPrismLanguage(language) || 'plaintext',
    [language],
  );

  useEffect(() => {
    setFoldableRanges(
      metadata.lexicalBlocks?.reduce(
        (acc, cur) => ({
          ...acc,
          [cur.start]: cur.end,
        }),
        {},
      ) || {},
    );
  }, [metadata.lexicalBlocks]);

  useEffect(() => {
    const bb: Record<number, BlameLine> = {};
    metadata.blame?.forEach((item) => {
      bb[item.lineRange.start] = {
        start: true,
        commit: item.commit,
      };
      bb[item.lineRange.end] = {
        start: false,
      };
    });

    setBlameLines(bb);
  }, [metadata.blame]);

  const toggleBlock = useCallback(
    (fold: boolean, start: number) => {
      for (let i = start + 1; i < foldableRanges[start]; i++) {
        setFoldedLines((prevState) =>
          fold
            ? { ...prevState, [i]: i }
            : {
                ...(prevState[i] !== i ? prevState : {}),
              },
        );
      }
    },
    [foldableRanges],
  );

  const codeRef = useRef<HTMLDivElement>(null);

  const tokens = useMemo(() => tokenizeCode(code, lang), [code, lang]);

  const onRefDefClick = useCallback(
    (
      lineNum: number,
      filePath: string,
      type: TokenInfoType,
      tokenName: string,
      tokenRange: string,
    ) => {
      navigateFullResult(filePath, {
        scrollToLine: `${lineNum}_${lineNum}`,
        type,
        tokenName,
        tokenRange,
      });
    },
    [repoName, relativePath],
  );

  useEffect(() => {
    if (deferredSearchTerm === '') {
      setSearchResults([]);
      setCurrentResult(0);
      return;
    }
    const lines = code.split('\n');
    const results = lines.reduce(function (prev: number[], cur, i) {
      if (cur.toLowerCase().includes(deferredSearchTerm.toLowerCase())) {
        prev.push(i);
      }
      return prev;
    }, []);
    const currentlyHighlightedLine = searchResults[currentResult - 1];
    const indexInNewResults = results.indexOf(currentlyHighlightedLine);
    setSearchResults(results);
    setCurrentResult(indexInNewResults >= 0 ? indexInNewResults + 1 : 1);
  }, [deferredSearchTerm]);

  useEffect(() => {
    if (searchResults[currentResult - 1]) {
      setScrollToIndex([
        searchResults[currentResult - 1],
        searchResults[currentResult - 1],
      ]);
    }
  }, [currentResult, searchResults]);

  const codeToCopy = useMemo(() => {
    if (!code || currentSelection.length !== 2) {
      return '';
    }
    const lines = code.split('\n');

    const [startLine, startChar] = currentSelection[0];
    const [endLine, endChar] = currentSelection[1];

    if (
      startLine === 0 &&
      startChar === 0 &&
      endLine === lines.length - 1 &&
      endChar === lines[lines.length - 1].length
    ) {
      return code;
    }

    let textToCopy = lines[startLine]?.slice(startChar, endChar);
    if (startLine !== endLine) {
      const firstLine = lines[startLine]?.slice(startChar);
      const lastLine = lines[endLine]?.slice(0, endChar + 1);
      const textBetween = lines?.slice(startLine + 1, endLine).join('\n');
      textToCopy =
        firstLine + '\n' + (textBetween ? textBetween + '\n' : '') + lastLine;
    }
    return textToCopy;
  }, [code, currentSelection]);

  const handleCopy = useCallback(
    (e: React.ClipboardEvent<HTMLPreElement>) => {
      if (codeToCopy && code.split('\n').length > MAX_LINES_BEFORE_VIRTUALIZE) {
        e.preventDefault();
        copyToClipboard(codeToCopy);
      }
    },
    [codeToCopy, code],
  );

  const handleKeyEvent = useCallback(
    (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === 'a' &&
        (event.target as HTMLElement)?.tagName !== 'INPUT' &&
        (event.target as HTMLElement)?.tagName !== 'TEXTAREA'
      ) {
        // Prevent the default action (i.e. selecting all text in the browser)
        event.preventDefault();
        setCurrentSelection([
          [0, 0],
          [tokens.length - 1, tokens[tokens.length - 1].length],
        ]);
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(codeRef.current || document.body);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    },
    [tokens],
  );
  useKeyboardNavigation(handleKeyEvent);

  const calculatePopupPosition = useCallback(
    (top: number, left: number) => {
      let container = findElementInCurrentTab('.code-modal-container');
      if (!container) {
        container = findElementInCurrentTab('#result-full-code-container');
      }
      if (!container) {
        return null;
      }
      const containerRect = container?.getBoundingClientRect();
      if (currentSelection.length !== 0) {
        return calculatePopupPositionInsideContainer(top, left, containerRect);
      }
      return null;
    },
    [currentSelection],
  );

  useEffect(() => {
    const handleWindowMouseUp = (e: MouseEvent) => {
      const { clientY, clientX } = e;

      setTimeout(() => {
        const text = window.getSelection()?.toString();
        if (text) {
          setPopupPosition(calculatePopupPosition(clientY, clientX));
        } else {
          setPopupPosition(null);
          setCurrentSelection([]);
        }
      }, 50);
    };

    codeRef.current?.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      codeRef.current?.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [calculatePopupPosition]);

  return (
    <div className="code-full-view w-full text-xs gap-10 flex flex-row relative">
      <SearchOnPage
        handleSearch={setSearchTerm}
        isSearchActive={isSearchActive}
        resultNum={searchResults.length}
        onCancel={() => {
          setSearchTerm('');
          setSearchActive(false);
          setScrollToIndex(undefined);
        }}
        currentResult={currentResult}
        setCurrentResult={setCurrentResult}
        searchValue={searchTerm}
        containerClassName="absolute top-0 -right-4"
      />
      <div className={`w-full overflow-auto`} ref={codeRef}>
        <pre
          className={`prism-code language-${lang} bg-bg-sub my-0 w-full h-full`}
          onCopy={handleCopy}
          ref={ref}
        >
          <CodeContainer
            key={relativePath}
            width={containerWidth}
            height={containerHeight}
            language={language}
            metadata={metadata}
            relativePath={relativePath}
            repoPath={repoPath}
            repoName={repoName}
            tokens={tokens}
            foldableRanges={foldableRanges}
            foldedLines={foldedLines}
            blameLines={blameLines}
            toggleBlock={toggleBlock}
            setCurrentSelection={setCurrentSelection}
            searchTerm={deferredSearchTerm}
            onRefDefClick={onRefDefClick}
            scrollToIndex={scrollToIndex}
            highlightColor={highlightColor}
          />
          <ExplainButton
            currentSelection={currentSelection}
            popupPosition={popupPosition}
            setPopupPosition={setPopupPosition}
            closePopup={closePopup}
            relativePath={relativePath}
            selectedLinesLength={codeToCopy.split('\n').length}
          />
        </pre>
      </div>
    </div>
  );
};

export default memo(CodeFull);
