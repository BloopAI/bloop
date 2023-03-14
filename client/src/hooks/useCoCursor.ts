import { useCallback, useContext } from 'react';
import { SearchContext } from '../context/searchContext';
import { SearchType } from '../types/general';
import { UIContext } from '../context/uiContext';
import { waitFor } from '../utils';
import {
  BLOOP_CURSOR,
  CLOSE_RESULT_MODAL,
  RESULTS_LIST,
  SEARCH_INPUT,
  SEARCH_TYPE_NL,
  SEARCH_TYPE_REGEX,
  SEARCH_TYPE_SELECT,
} from '../consts/elementIds';

const useCoCursor = () => {
  const { searchType, setInputValue } = useContext(SearchContext);
  const { funcRefs } = useContext(UIContext);

  const moveCursorTo = useCallback(async (top: number, left: number) => {
    const bloopCursor = document.getElementById(BLOOP_CURSOR);
    if (!bloopCursor) {
      return;
    }
    bloopCursor.style.top = top + 'px';
    bloopCursor.style.left = left + 'px';
    await waitFor(
      parseFloat(getComputedStyle(bloopCursor).transitionDuration) * 1000 + 100,
    );
  }, []);

  const setCursorSpeed = useCallback((seconds: number) => {
    const bloopCursor = document.getElementById(BLOOP_CURSOR);
    if (!bloopCursor) {
      return;
    }
    bloopCursor.style.transitionDuration = seconds + 's';
  }, []);

  const switchSearchType = useCallback(
    async (newSearchType: SearchType) => {
      const searchTypeSelect = document.getElementById(SEARCH_TYPE_SELECT);
      if (!searchTypeSelect) {
        return;
      }
      if (searchType !== newSearchType) {
        await moveCursorTo(
          searchTypeSelect.getBoundingClientRect().top,
          searchTypeSelect.getBoundingClientRect().left,
        );
        searchTypeSelect.focus();
        await waitFor(100);
        searchTypeSelect.click();
        await waitFor(500);
        const searchTypeBtn = document.getElementById(
          newSearchType === SearchType.REGEX
            ? SEARCH_TYPE_REGEX
            : SEARCH_TYPE_NL,
        );
        const searchTypeBtnBox = searchTypeBtn!.getBoundingClientRect();
        await moveCursorTo(
          searchTypeBtnBox.top + searchTypeBtnBox.height / 2,
          searchTypeBtnBox.left + 4,
        );
        searchTypeBtn!.focus();
        await waitFor(200);
        searchTypeBtn!.click();
        await waitFor(500);
      }
    },
    [searchType],
  );

  const inputQueryAndSearch = useCallback(async (query: string) => {
    const searchInput = document.getElementById(SEARCH_INPUT);
    if (!searchInput) {
      return;
    }
    await moveCursorTo(
      searchInput.getBoundingClientRect().top,
      searchInput.getBoundingClientRect().left,
    );
    searchInput.focus();
    await waitFor(500);
    setInputValue('');
    for (let char of query.split('')) {
      setInputValue((prev) => prev + char);
      await waitFor(200);
    }
    funcRefs.searchSubmitRef.current();
  }, []);

  const makeRegexSearch = useCallback(
    async (query: string) => {
      const closeResultModalBtn = document.getElementById(CLOSE_RESULT_MODAL);
      if (closeResultModalBtn) {
        closeResultModalBtn.click();
      }
      await switchSearchType(SearchType.REGEX);
      await inputQueryAndSearch(query);
    },
    [searchType],
  );

  const makeNLSearch = useCallback(
    async (query: string) => {
      const closeResultModalBtn = document.getElementById(CLOSE_RESULT_MODAL);
      if (closeResultModalBtn) {
        closeResultModalBtn.click();
      }
      await switchSearchType(SearchType.NL);
      await inputQueryAndSearch(query);
    },
    [searchType],
  );

  const openResult = useCallback(async (resultIndex: number) => {
    const resultsList = document.getElementById(RESULTS_LIST);
    if (resultsList?.children.length) {
      const itemToClick = resultsList.children[resultIndex].firstChild
        ?.childNodes[1]?.firstChild?.firstChild as HTMLElement;
      if (itemToClick) {
        await moveCursorTo(80, window.innerWidth / 2);
        itemToClick.scrollIntoView({ inline: 'center', behavior: 'smooth' });
        await waitFor(1000);
        const box = itemToClick.getBoundingClientRect();
        await moveCursorTo(box.top + box.height / 2, box.left + 50);
        funcRefs.resultsClickHandlers.current[resultIndex]?.();
      }
    }
  }, []);

  const selectText = useCallback(async (lineStart: number, lineEnd: number) => {
    funcRefs.codeSelectStartRef.current(lineStart, 0);
    funcRefs.codeSelectEndRef.current(lineEnd, 0);
    const firstLine = document.querySelector(
      `[data-line-number="${lineStart}"]`,
    );
    const lastLine = document.querySelector(`[data-line-number="${lineEnd}"]`);
    if (firstLine) {
      await moveCursorTo(
        firstLine.getBoundingClientRect().top,
        firstLine.getBoundingClientRect().left + 30,
      );
    }
    setCursorSpeed((lineEnd - lineStart + 1) * 0.1);
    if (lastLine) {
      moveCursorTo(
        lastLine.getBoundingClientRect().bottom,
        lastLine.getBoundingClientRect().left + 30,
      );
    }
    const selection = window.getSelection();
    for (let i = lineStart; i <= lineEnd; i++) {
      const currLine = document.querySelector(`[data-line-number="${i}"]`);
      if (currLine) {
        const range = document.createRange();
        range.setStartBefore(
          document.querySelector(`[data-line-number="${lineStart}"]`)!,
        );
        range.setEndAfter(currLine);
        selection?.removeAllRanges();
        selection?.addRange(range);
        await waitFor(90);
      }
    }
    setCursorSpeed(0.7);
  }, []);

  return {
    makeRegexSearch,
    makeNLSearch,
    openResult,
    selectText,
  };
};

export default useCoCursor;
