import React, { useCallback, useEffect, useState } from 'react';
import {
  ACTIVE_HIGHLIGHT_CLASSNAME,
  HIGHLIGHT_CLASSNAME,
  markNode,
  unmark,
} from '../../../client/src/utils/textSearch';
import SearchOnPage from '../../../client/src/components/SearchOnPage';

const TextSearch = ({
  contentRoot,
}: {
  contentRoot: HTMLDivElement | null;
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [isSearchActive, setSearchActive] = useState(false);
  const [resultNum, setResultNum] = useState(0);
  const [currentResult, setCurrentResult] = useState(0);
  const [currentHighlightParent, setCurrentHighlightParent] =
    useState<HTMLElement | null>(null);

  useEffect(() => {
    const toggleSearch = (e: KeyboardEvent) => {
      const fullCodeInView =
        !!document.getElementsByClassName('code-full-view').length;
      if (e.code === 'KeyF' && e.metaKey && !fullCodeInView) {
        setSearchActive((prev) => !prev);
      } else if (e.code === 'Enter') {
        const isNext = !e.shiftKey;
        setCurrentResult((prev) =>
          isNext
            ? prev < resultNum
              ? prev + 1
              : 1
            : prev > 1
            ? prev - 1
            : resultNum,
        );
      } else if (e.code === 'Escape') {
        setSearchActive((prev) => {
          if (prev) {
            e.preventDefault();
          }
          return false;
        });
      }
    };
    window.addEventListener('keypress', toggleSearch);

    return () => {
      window.removeEventListener('keypress', toggleSearch);
    };
  }, [resultNum]);

  useEffect(() => {
    if (!isSearchActive) {
      unmark();
    }
  }, [isSearchActive]);

  const doSearch = useCallback(
    (searchTerm: string) => {
      unmark();

      if (searchTerm === '') {
        setResultNum(0);
        setCurrentResult(0);
        setCurrentHighlightParent(null);
        return;
      }
      const regex = new RegExp(searchTerm, 'gi');
      if (contentRoot) {
        markNode(contentRoot, regex);
        const allHighlights =
          document.getElementsByClassName(HIGHLIGHT_CLASSNAME);
        const resNum = allHighlights.length;
        setResultNum(resNum);
        let prevIndexInNewHighlights = currentHighlightParent
          ? [...allHighlights].findIndex((el) =>
              el.parentNode?.parentNode?.isSameNode(currentHighlightParent),
            )
          : -1;
        setCurrentResult((prev) => {
          const newR = resNum
            ? prevIndexInNewHighlights >= 0
              ? prevIndexInNewHighlights + 1
              : 1
            : 0;
          if (prev === newR && allHighlights?.[newR - 1]) {
            allHighlights[newR - 1].classList?.add(ACTIVE_HIGHLIGHT_CLASSNAME);
            setCurrentHighlightParent(
              allHighlights[newR - 1].parentNode as HTMLElement,
            );
          }
          return newR;
        });
      }
    },
    [contentRoot, currentHighlightParent],
  );

  const handleChange = useCallback(
    (searchTerm: string) => {
      setSearchValue(searchTerm);
      doSearch(searchTerm);
    },
    [doSearch],
  );

  useEffect(() => {
    const highlights = document.getElementsByClassName(HIGHLIGHT_CLASSNAME);
    [...highlights].forEach((el) =>
      el.classList.remove(ACTIVE_HIGHLIGHT_CLASSNAME),
    );
    const elementToShow = highlights[currentResult - 1];
    if (elementToShow) {
      setCurrentHighlightParent(elementToShow.parentNode as HTMLElement);
      elementToShow.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
      elementToShow.classList.add(ACTIVE_HIGHLIGHT_CLASSNAME);
    }
  }, [currentResult]);

  return (
    <SearchOnPage
      onCancel={() => {
        handleChange('');
        setSearchActive(false);
      }}
      handleSearch={handleChange}
      isSearchActive={isSearchActive}
      resultNum={resultNum}
      currentResult={currentResult}
      setCurrentResult={setCurrentResult}
      searchValue={searchValue}
      containerClassName="fixed top-[66px] right-[5px]"
    />
  );
};

export default TextSearch;
