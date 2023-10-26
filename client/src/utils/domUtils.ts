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

export const isFocusInInput = () =>
  ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');
