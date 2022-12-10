import React, { useRef, useEffect } from 'react';

function handleEnter({
  event,
  currentIndex,
  activeElement,
  inputElement,
}: any) {
  if (currentIndex === -1) return;

  activeElement.click();
  event.preventDefault();
  inputElement?.focus();
}

function handleArrowKey({ event, currentIndex, availableElements }: any) {
  // If the focus isn't in the container, focus on the first thing
  if (currentIndex === -1) availableElements[0].focus();

  // Move the focus up or down
  let nextElement: HTMLElement | undefined;
  const isArrowUp = event.key === 'ArrowUp';
  const isArrowDown = event.key === 'ArrowDown';

  if (isArrowDown) {
    // This will change the focus back to the first element
    // if ArrowDown is triggered on last element
    if (currentIndex === availableElements.length - 1) {
      nextElement = availableElements[0];
    } else {
      nextElement = availableElements[currentIndex + 1];
    }
  }

  if (isArrowUp) {
    // This will change the focus to the last element
    // if ArrowUp is triggered on first element/not triggered at all
    if (currentIndex === 0) {
      nextElement = availableElements[availableElements.length - 1];
    } else {
      nextElement = availableElements[currentIndex - 1];
    }
  }

  nextElement && nextElement.focus();
  event.preventDefault();
}

type Options = {
  event: KeyboardEvent;
  parentNode: HTMLElement;
  selectors?: string;
  tabSelects?: boolean;
};

function handleEvents({
  event,
  parentNode,
  selectors = 'a,button,input',
  tabSelects = false,
}: Options): boolean {
  if (!parentNode) return true;

  const key = event.key;
  const supportedKeys = ['ArrowUp', 'ArrowDown', 'Enter'];
  if (tabSelects) {
    supportedKeys.push('Tab');
  }
  if (!supportedKeys.includes(key)) {
    return true;
  }

  const activeElement = document.activeElement;
  /* If we're not inside the container, don't do anything */
  if (!parentNode.contains(activeElement)) return true;

  // Get the list of elements we're allowed to scroll through
  const availableElements = Array.from(
    parentNode.querySelectorAll(selectors),
  ).filter(
    (item) =>
      item.getBoundingClientRect().width !== 0 &&
      item.getBoundingClientRect().height !== 0,
  );

  // No elements are available to loop through.
  if (!availableElements.length) return true;

  // Which index is currently selected
  const currentIndex = Array.from(availableElements).findIndex(
    (availableElement) => availableElement === activeElement,
  );

  if (key === 'Enter' || (tabSelects && key === 'Tab')) {
    if (activeElement?.tagName !== 'INPUT') {
      handleEnter({
        event,
        currentIndex,
        activeElement,
        inputElement: availableElements[0],
      });
    } else {
      return true;
    }
  }

  handleArrowKey({ event, currentIndex, availableElements });
  return true;
}

export function useArrowKeyNavigation(props?: {
  selectors: string;
  tabSelects?: boolean;
}): React.RefObject<HTMLDivElement> {
  const { selectors } = props || {};
  const parentNode = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventHandler = (event: KeyboardEvent) => {
      if (parentNode.current) {
        handleEvents({
          event,
          parentNode: parentNode.current,
          selectors,
          tabSelects: props?.tabSelects,
        });
      }
    };
    document.addEventListener('keydown', eventHandler);
    return () => document.removeEventListener('keydown', eventHandler);
  }, []);

  return parentNode;
}
