import TextInput from '@bloop/client/src/components/TextInput';
import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';

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
          // searchCount++;
          return `<span class="search-highlight">${match}</span>`;
        });
        if (newValue !== nodeValue) {
          const newElement = document.createElement('span');
          newElement.innerHTML = newValue;
          childNode.parentNode?.replaceChild(newElement, childNode);
        }
      }
    } else if (childNode.nodeType === Node.ELEMENT_NODE) {
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

      if (searchTerm === '') {
        return;
      }
      const regex = new RegExp(searchTerm, 'gi');
      if (contentRoot) {
        markNode(contentRoot, regex);
      }
    },
    [contentRoot],
  );

  return isSearchActive ? (
    <div className="fixed top-[66px] right-[5px] z-50 bg-gray-900">
      <TextInput
        type="text"
        id="app-search"
        name="app-search"
        autoFocus
        value={searchValue}
        onChange={handleChange}
      />
    </div>
  ) : null;
};

export default TextSearch;
