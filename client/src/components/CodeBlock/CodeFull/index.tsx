import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import debounce from 'lodash.debounce';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import MiniMap from '../MiniMap';
import { getPrismLanguage, tokenizeCode } from '../../../utils/prism';
import { Range, TokenInfoItem } from '../../../types/results';
import { copyToClipboard } from '../../../utils';
import { Commit } from '../../../types';
import useAppNavigation from '../../../hooks/useAppNavigation';
import SearchOnPage from '../../SearchOnPage';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { useOnClickOutside } from '../../../hooks/useOnClickOutsideHook';
import { Feather, Info, Sparkle } from '../../../icons';
import { ChatContext } from '../../../context/chatContext';
import { MAX_LINES_BEFORE_VIRTUALIZE } from '../../../consts/code';
import CodeContainer from './CodeContainer';

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
  minimap?: boolean;
  scrollElement: HTMLDivElement | null;
  relativePath: string;
  repoPath: string;
  repoName: string;
  containerWidth: number;
  containerHeight: number;
  isOnResultPage?: boolean;
};

const CodeFull = ({
  language,
  code,
  metadata,
  scrollElement,
  minimap,
  relativePath,
  repoPath,
  repoName,
  containerWidth,
  containerHeight,
  isOnResultPage,
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
      searchParams
        .get('scroll_line_index')
        ?.split('_')
        .map((i) => Number(i)),
    [searchParams],
  );
  const highlightColor = useMemo(
    () => searchParams.get('highlight_color'),
    [searchParams],
  );
  const [scrollToIndex, setScrollToIndex] = useState(
    scrollLineNumber || undefined,
  );
  const ref = useRef<HTMLPreElement>(null);
  useOnClickOutside(ref, () => setCurrentSelection([]));

  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const {
    setSubmittedQuery,
    setChatOpen,
    setSelectedLines,
    setConversation,
    setThreadId,
  } = useContext(ChatContext);
  const { navigateRepoPath } = useAppNavigation();

  const [isSearchActive, setSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentResult, setCurrentResult] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

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

  const [scrollPosition, setScrollPosition] = useState(0);
  const codeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = debounce((val) => {
      setScrollPosition((val.target as HTMLDivElement).scrollTop || 0);
    }, 300);

    scrollElement?.addEventListener('scroll', handleScroll);
    return () => scrollElement?.removeEventListener('scroll', handleScroll);
  });

  const tokens = useMemo(() => tokenizeCode(code, lang), [code, lang]);

  const onRefDefClick = useCallback(
    (item: TokenInfoItem, filePath: string) => {
      if (filePath === relativePath) {
        setScrollToIndex([item.line, item.line]);
      } else {
        navigateRepoPath(repoName, filePath, {
          scroll_line_index: `${item.line}_${item.line}`,
        });
      }
    },
    [repoName, relativePath],
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearchTerm(value);
      if (value === '') {
        setSearchResults([]);
        setCurrentResult(0);
        return;
      }
      const lines = code.split('\n');
      const results = lines.reduce(function (prev: number[], cur, i) {
        if (cur.toLowerCase().includes(value.toLowerCase())) {
          prev.push(i);
        }
        return prev;
      }, []);
      const currentlyHighlightedLine = searchResults[currentResult - 1];
      const indexInNewResults = results.indexOf(currentlyHighlightedLine);
      setSearchResults(results);
      setCurrentResult(indexInNewResults >= 0 ? indexInNewResults + 1 : 1);
    },
    [code, searchResults, currentResult],
  );

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

    let textToCopy = lines[startLine].slice(startChar, endChar);
    if (startLine !== endLine) {
      const firstLine = lines[startLine].slice(startChar);
      const lastLine = lines[endLine].slice(0, endChar + 1);
      const textBetween = lines.slice(startLine + 1, endLine).join('\n');
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

  useEffect(() => {
    if (isOnResultPage && currentSelection.length == 2) {
      const topLine = document.querySelector(
        `[data-line-number="${currentSelection[0][0]}"]`,
      );
      if (topLine) {
        const rect = topLine.getBoundingClientRect();
        setPopupPosition({ top: rect.top - 40, left: rect.left + 40 });
      }
    } else {
      setPopupPosition(null);
    }
  }, [isOnResultPage, currentSelection]);
  console.log(highlightColor);
  return (
    <div className="code-full-view w-full text-xs gap-10 flex flex-row relative">
      <SearchOnPage
        handleSearch={handleSearch}
        isSearchActive={isSearchActive}
        resultNum={searchResults.length}
        onCancel={() => {
          handleSearch('');
          setSearchActive(false);
          setScrollToIndex(undefined);
        }}
        currentResult={currentResult}
        setCurrentResult={setCurrentResult}
        searchValue={searchTerm}
        containerClassName="absolute top-0 -right-4"
      />
      <div className={`${!minimap ? 'w-full' : ''}`} ref={codeRef}>
        <pre
          className={`prism-code language-${lang} bg-bg-sub my-0 w-full h-full`}
          onCopy={handleCopy}
          ref={ref}
        >
          <CodeContainer
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
            searchTerm={searchTerm}
            onRefDefClick={onRefDefClick}
            scrollToIndex={scrollToIndex}
            highlightColor={highlightColor}
          />
          <AnimatePresence>
            {popupPosition && (
              <motion.div
                className="fixed"
                style={popupPosition}
                initial={{ opacity: 0, transform: 'translateY(1rem)' }}
                animate={{ transform: 'translateY(0rem)', opacity: 1 }}
                exit={{ opacity: 0, transform: 'translateY(1rem)' }}
              >
                <div className="bg-bg-base border border-bg-border rounded-md shadow-high flex overflow-hidden select-none">
                  {codeToCopy.length > 1500 ? (
                    <button
                      className="h-8 flex items-center justify-center gap-1 px-2 caption text-label-muted"
                      disabled
                    >
                      <div className="w-4 h-4">
                        <Info raw />
                      </div>
                      Select less code
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setChatOpen(true);
                          setThreadId('');
                          setConversation([]);
                          setSelectedLines([
                            currentSelection[0]![0],
                            currentSelection[1]![0],
                          ]);
                          setTimeout(
                            () =>
                              document
                                .getElementById('question-input')
                                ?.focus(),
                            300,
                          );
                        }}
                        className="h-8 flex items-center justify-center gap-1 px-2 hover:bg-bg-base-hover border-r border-bg-border caption text-label-title"
                      >
                        <div className="w-4 h-4">
                          <Feather raw />
                        </div>
                        Ask bloop
                      </button>
                      <button
                        onClick={() => {
                          setConversation([]);
                          setThreadId('');
                          setSelectedLines([
                            currentSelection[0]![0],
                            currentSelection[1]![0],
                          ]);
                          setSubmittedQuery(
                            `#explain_${relativePath}:${
                              currentSelection[0]![0]
                            }-${currentSelection[1]![0]}`,
                          );
                          setChatOpen(true);
                        }}
                        className="h-8 flex items-center justify-center gap-1 px-2 hover:bg-bg-base-hover caption text-label-title"
                      >
                        <div className="w-4 h-4">
                          <Sparkle raw />
                        </div>
                        Explain
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </pre>
      </div>
      {minimap && (
        <div className="w-36">
          <MiniMap
            code={code}
            language={language}
            codeFullHeight={scrollElement?.scrollHeight || 0}
            codeVisibleHeight={scrollElement?.clientHeight || 0}
            codeScroll={scrollPosition}
            handleScroll={(v) => {
              scrollElement?.scrollTo(0, v);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CodeFull;
