import { useCallback, useContext } from 'react';
import { SearchContext } from '../context/searchContext';
import { SearchType } from '../types/general';
import { UIContext } from '../context/uiContext';
import { waitFor } from '../utils';

const useCoCursor = () => {
  const { searchType, setInputValue } = useContext(SearchContext);
  const { uiRefs } = useContext(UIContext);

  const moveCursorTo = async (top: number, left: number) => {
    uiRefs.coCursor!.current!.style.top = top + 'px';
    uiRefs.coCursor!.current!.style.left = left + 'px';
    await waitFor(
      parseFloat(
        getComputedStyle(uiRefs.coCursor!.current!).transitionDuration,
      ) *
        1000 +
        100,
    );
  };

  const makeRegexSearch = useCallback(
    async (query: string) => {
      if (searchType !== SearchType.REGEX) {
        await moveCursorTo(
          uiRefs.searchTypeSelectBtn.current!.getBoundingClientRect().top,
          uiRefs.searchTypeSelectBtn.current!.getBoundingClientRect().left,
        );
        uiRefs.searchTypeSelectBtn?.current?.focus();
        uiRefs.searchTypeSelectBtn?.current?.click();
        await waitFor(500);
        await moveCursorTo(
          uiRefs.searchTypeRegexBtn.current!.getBoundingClientRect().top,
          uiRefs.searchTypeRegexBtn.current!.getBoundingClientRect().left,
        );
        uiRefs.searchTypeRegexBtn?.current?.focus();
        uiRefs.searchTypeRegexBtn?.current?.click();
        await waitFor(500);
      }
      if (uiRefs.searchInputRef?.current) {
        await moveCursorTo(
          uiRefs.searchInputRef.current!.getBoundingClientRect().top,
          uiRefs.searchInputRef.current!.getBoundingClientRect().left,
        );
        uiRefs.searchInputRef.current.focus();
        await waitFor(500);
        setInputValue('');
        for (let char of query.split('')) {
          setInputValue((prev) => prev + char);
          await waitFor(200);
        }
        uiRefs.searchSubmitRef.current();
      }
    },
    [searchType],
  );

  const selectText = useCallback(
    async (
      lineStart: number,
      charStart: number,
      lineEnd: number,
      charEnd: number,
    ) => {
      uiRefs.codeSelectStartRef.current(lineStart, charStart);
      uiRefs.codeSelectEndRef.current(lineEnd, charEnd);
      const selection = window.getSelection();
      for (let i = lineStart; i <= lineEnd; i++) {
        if (document.querySelector(`[data-line-number="${i}"]`)) {
          await moveCursorTo(
            document
              .querySelector(`[data-line-number="${i}"]`)!
              .getBoundingClientRect().top,
            document
              .querySelector(`[data-line-number="${i}"]`)!
              .getBoundingClientRect().left + 30,
          );
        }
        const range = document.createRange();
        range.setStartBefore(
          document.querySelector(`[data-line-number="${lineStart}"]`) ||
            document.body,
        );
        range.setEndAfter(
          document.querySelector(`[data-line-number="${i}"]`) || document.body,
        );
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    },
    [],
  );

  return {
    makeRegexSearch,
    selectText,
  };
};

export default useCoCursor;
