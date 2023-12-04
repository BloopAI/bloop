export const findElementInCurrentTab = (
  selector: string,
): HTMLElement | null => {
  return document.querySelector(`[data-active="true"] ${selector}`);
};

export const findAllElementsInCurrentTab = <
  T extends HTMLElement = HTMLElement,
>(
  selector: string,
  // eslint-disable-next-line no-undef
): NodeListOf<T> | null => {
  return document.querySelectorAll(`[data-active="true"] ${selector}`);
};

export const isFocusInInput = (ignoreCommandInput?: boolean) => {
  const isInInput = ['INPUT', 'TEXTAREA'].includes(
    document.activeElement?.tagName || '',
  );
  const isInCommandInput = document.activeElement?.id === 'command-input';
  return ignoreCommandInput ? isInInput && !isInCommandInput : isInInput;
};
