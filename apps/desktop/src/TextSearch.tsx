import TextInput from '@bloop/client/src/components/TextInput';
import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from '@bloop/client/src/icons';

function unmark(): void {
  const markedElements = document.querySelectorAll('.search-highlight');
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
          return `<span class="search-highlight">${match}</span>`;
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

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const searchTerm = e.target.value;
      setSearchValue(searchTerm);
      unmark();

      setCurrentResult(0);
      if (searchTerm === '') {
        setResultNum(0);
        return;
      }
      const regex = new RegExp(searchTerm, 'gi');
      if (contentRoot) {
        markNode(contentRoot, regex);
        setResultNum(
          document.getElementsByClassName('search-highlight').length,
        );
      }
    },
    [contentRoot],
  );

  useEffect(() => {
    const highlights = document.getElementsByClassName('search-highlight');
    [...highlights].forEach((el) =>
      el.classList.remove('search-highlight-active'),
    );
    const elementToShow = highlights[currentResult - 1];
    if (elementToShow) {
      elementToShow.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
      elementToShow.classList.add('search-highlight-active');
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
      <div className="flex items-center absolute top-0.5 right-9 caption text-gray-300">
        {resultNum ? (
          <span>
            {currentResult}/{resultNum}
          </span>
        ) : null}
        <button
          className="p-2 hover:text-gray-50 disabled:hover:text-gray-300"
          onClick={() =>
            setCurrentResult((prev) => (prev < resultNum ? prev + 1 : 1))
          }
          disabled={!searchValue}
        >
          <ChevronDown />
        </button>
        <button
          className="p-2 hover:text-gray-50 disabled:hover:text-gray-300"
          onClick={() =>
            setCurrentResult((prev) => (prev > 1 ? prev - 1 : resultNum))
          }
          disabled={!searchValue}
        >
          <ChevronUp />
        </button>
      </div>
    </div>
  ) : null;
};

export default TextSearch;
