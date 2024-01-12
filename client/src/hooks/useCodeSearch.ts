import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { checkEventKeys } from '../utils/keyboardUtils';
import useKeyboardNavigation from './useKeyboardNavigation';

type Props = {
  setScrollToIndex: (i?: [number, number]) => void;
  isDisabled?: boolean;
  code: string;
};
export const useCodeSearch = ({
  setScrollToIndex,
  isDisabled,
  code,
}: Props) => {
  const [isSearchActive, setSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentResult, setCurrentResult] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, ['cmd', 'F'])) {
        e.preventDefault();
        e.stopPropagation();
        setSearchActive((prev) => !prev);
        return false;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSearchActive((prev) => {
          if (prev) {
            e.preventDefault();
          }
          return false;
        });
        setScrollToIndex(undefined);
        setSearchTerm('');
      } else if (e.key === 'Enter') {
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
      }
    },
    [searchResults],
  );
  useKeyboardNavigation(handleKeyEvent, isDisabled);

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

  const handleSearchCancel = useCallback(() => {
    setSearchTerm('');
    setSearchActive(false);
    setScrollToIndex(undefined);
  }, []);

  return {
    setSearchTerm,
    handleSearchCancel,
    isSearchActive,
    searchResults,
    currentResult,
    setCurrentResult,
    searchTerm,
    deferredSearchTerm,
  };
};
