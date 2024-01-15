export const findElementInCurrentTab = (
  selector: string,
): HTMLElement | null => {
  return document.querySelector(selector);
};

export const findAllElementsInCurrentTab = <
  T extends HTMLElement = HTMLElement,
>(
  selector: string,
  // eslint-disable-next-line no-undef
): NodeListOf<T> | null => {
  return document.querySelectorAll(selector);
};

export const isFocusInInput = (ignoreCommandInput?: boolean) => {
  const isInInput =
    ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '') ||
    (document.activeElement as HTMLElement)?.isContentEditable;
  const isInCommandInput = document.activeElement?.id === 'command-input';
  return ignoreCommandInput ? isInInput && !isInCommandInput : isInInput;
};

export const focusInput = () => {
  findElementInCurrentTab('.ProseMirror')?.focus();
};

export const blurInput = () => {
  findElementInCurrentTab('.ProseMirror')?.blur();
};
