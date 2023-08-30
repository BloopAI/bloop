import React, {
  Dispatch,
  memo,
  MutableRefObject,
  SetStateAction,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPrismLanguage, tokenizeCode } from '../../../utils/prism';
import SearchOnPage from '../../SearchOnPage';
import CodeContainer from './CodeContainer';

type Props = {
  code: string;
  language: string;
  relativePath: string;
  containerWidth: number;
  containerHeight: number;
  currentSelection: [number, number][];
  setCurrentSelection: Dispatch<SetStateAction<[number, number][]>>;
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>;
};

const CodeFull = ({
  language,
  code,
  relativePath,
  containerWidth,
  containerHeight,
  currentSelection,
  setCurrentSelection,
  scrollContainerRef,
}: Props) => {
  const [searchParams] = useSearchParams();
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
  const [scrollToIndex, setScrollToIndex] = useState(
    scrollLineNumber || undefined,
  );
  const ref = useRef<HTMLPreElement>(null);

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

  const codeRef = useRef<HTMLDivElement>(null);

  const tokens = useMemo(() => tokenizeCode(code, lang), [code, lang]);

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

  return (
    <div className="w-full text-xs gap-10 flex flex-row relative">
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
      <div className={`w-full`} ref={codeRef}>
        <pre
          className={`prism-code language-${lang} bg-bg-sub my-0 w-full h-full`}
          ref={ref}
        >
          <CodeContainer
            key={relativePath}
            width={containerWidth}
            height={containerHeight}
            relativePath={relativePath}
            tokens={tokens}
            setCurrentSelection={setCurrentSelection}
            currentSelection={currentSelection}
            searchTerm={deferredSearchTerm}
            scrollToIndex={scrollToIndex}
            scrollContainerRef={scrollContainerRef}
          />
        </pre>
      </div>
    </div>
  );
};

export default memo(CodeFull);
