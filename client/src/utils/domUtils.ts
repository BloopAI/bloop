export const findElementInCurrentTab = (
  selector: string,
): HTMLElement | null => {
  return document.querySelector(`[data-active="true"] ${selector}`);
};
