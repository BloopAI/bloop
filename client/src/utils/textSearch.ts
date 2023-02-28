export const HIGHLIGHT_CLASSNAME = 'search-highlight';
export const ACTIVE_HIGHLIGHT_CLASSNAME = 'search-highlight-active';

export function unmark(parentNode?: HTMLElement): void {
  const markedElements = (parentNode || document).querySelectorAll(
    `.${HIGHLIGHT_CLASSNAME}`,
  );
  for (let i = 0; i < markedElements.length; i++) {
    const element = markedElements[i] as HTMLElement;
    const parentNode = element.parentNode as HTMLElement;
    const text = element.innerText;
    const textNode = document.createTextNode(text);
    parentNode.replaceChild(textNode, element);
    joinTextNodes(parentNode);
  }
}

export function joinTextNodes(parentNode: HTMLElement): void {
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

export function markNode(node: HTMLElement, regex: RegExp): void {
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
