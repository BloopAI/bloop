import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
import TextInput from '../../../client/src/components/TextInput';
import { ChevronDown, ChevronUp } from '../../../client/src/icons';

const HIGHLIGHT_CLASSNAME = 'search-highlight';
const ACTIVE_HIGHLIGHT_CLASSNAME = 'search-highlight-active';

function unmark(): void {
  const markedElements = document.querySelectorAll(`.${HIGHLIGHT_CLASSNAME}`);
  for (let i = 0; i < markedElements.length; i++) {
    const element = markedElements[i] as HTMLElement;
    const parentNode = element.parentNode as HTMLElement;
    const text = element.innerText;
    const textNode = document.createTextNode(text);
    parentNode.replaceChild(textNode, element);
    joinTextNodes(parentNode);
  }
}

function joinTextNodes(parentNode: HTMLElement): void {
  const childNodes = parentNode.childNodes;
  const newChildNodes = [];
  let currentText = '';
  for (let i = 0; i < childNodes.length; i++) {
    const childNode = childNodes[i];
    if (childNode.nodeType === Node.TEXT_NODE) {
      currentText += childNode.textContent;
    } else {
      if (currentText !== '') {
        newChildNodes.push(document.createTextNode(currentText));
        currentText = '';
      }
      newChildNodes.push(childNode);
    }
  }
  if (currentText !== '') {
    newChildNodes.push(document.createTextNode(currentText));
  }
  while (parentNode.firstChild) {
    parentNode.removeChild(parentNode.firstChild);
  }
  for (let j = 0; j < newChildNodes.length; j++) {
    parentNode.appendChild(newChildNodes[j]);
  }
}

function markNode(node: HTMLElement, regex: RegExp): void {
  for (let i = 0; i < node.childNodes.length; i++) {
    const childNode = node.childNodes[i];
    if (childNode.nodeType === Node.TEXT_NODE) {
      const nodeValue = childNode.nodeValue;
      if (nodeValue) {
        const newValue = nodeValue.replace(regex, function (match) {
          return `<span class="${HIGHLIGHT_CLASSNAME}">${match}</span>`;
        });
        if (newValue !== nodeValue) {
          const newElement = document.createElement('span');
          newElement.innerHTML = newValue;
          childNode.parentNode?.replaceChild(newElement, childNode);
        }
      }
    } else if (childNode.nodeType === Node.ELEMENT_NODE) {
      const computedNodeStyle = window.getComputedStyle(
        childNode as Element,
        null,
      );
      if (
        computedNodeStyle.visibility === 'hidden' ||
        computedNodeStyle.display === 'none' ||
        computedNodeStyle.opacity === '0'
      ) {
        continue;
      }
      markNode(childNode as HTMLElement, regex);
    }
  }
}

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
      if (e.code === 'KeyF' && e.metaKey) {
        setSearchActive((prev) => !prev);
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
  }, []);

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
        let prevIncedInNewHighlights = currentHighlightParent
          ? [...allHighlights].findIndex((el) =>
              el.parentNode?.parentNode?.isSameNode(currentHighlightParent),
            )
          : -1;
        setCurrentResult((prev) => {
          const newR = resNum
            ? prevIncedInNewHighlights >= 0
              ? prevIncedInNewHighlights + 1
              : 1
            : 0;
          if (prev === newR) {
            allHighlights[newR - 1].classList.add(ACTIVE_HIGHLIGHT_CLASSNAME);
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
    (e: ChangeEvent<HTMLInputElement>) => {
      const searchTerm = e.target.value;
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

  return isSearchActive ? (
    <div
      className="fixed top-[66px] right-[5px] z-50 bg-gray-900 bg-opacity-80"
      style={{
        backdropFilter: 'blur(1px)',
        WebkitBackdropFilter: 'blur(1px)',
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setCurrentResult((prev) => (prev < resultNum ? prev + 1 : 1));
        }}
      >
        <TextInput
          type="search"
          id="app-search"
          name="app-search"
          autoFocus
          value={searchValue}
          onChange={handleChange}
          forceClear
          inputClassName="pr-24"
        />
      </form>
      <div className="flex items-center absolute top-0.5 right-9 caption text-gray-300">
        {resultNum ? (
          <span>
            {currentResult}/{resultNum}
          </span>
        ) : null}
        <button
          className="p-2 hover:text-gray-50 disabled:hover:text-gray-300"
          onClick={() =>
            setCurrentResult((prev) => (prev > 1 ? prev - 1 : resultNum))
          }
          disabled={!searchValue}
        >
          <ChevronUp />
        </button>
        <button
          className="p-2 hover:text-gray-50 disabled:hover:text-gray-300"
          onClick={() =>
            setCurrentResult((prev) => (prev < resultNum ? prev + 1 : 1))
          }
          disabled={!searchValue}
        >
          <ChevronDown />
        </button>
      </div>
    </div>
  ) : null;
};

export default TextSearch;
