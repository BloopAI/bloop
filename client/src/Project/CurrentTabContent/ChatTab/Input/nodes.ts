import * as icons from 'file-icons-js';
import { type AttributeSpec, type NodeSpec } from 'prosemirror-model';
import { getFileExtensionForLang, splitPath } from '../../../../utils';

export const mentionNode: NodeSpec = {
  group: 'inline',
  inline: true,
  atom: true,

  attrs: {
    id: '' as AttributeSpec,
    display: '' as AttributeSpec,
    type: 'lang' as AttributeSpec,
    isFirst: '' as AttributeSpec,
  },

  selectable: false,
  draggable: false,

  toDOM: (node) => {
    const isDir =
      node.attrs.type === 'dir' ||
      node.attrs.display.endsWith('/') ||
      node.attrs.display.endsWith('\\');
    const folderIcon = document.createElement('span');
    folderIcon.innerHTML = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M2 5.5C2 4.39543 2.89543 3.5 4 3.5H7.17157C7.70201 3.5 8.21071 3.71071 8.58579 4.08579L9.41421 4.91421C9.78929 5.28929 10.298 5.5 10.8284 5.5H16C17.1046 5.5 18 6.39543 18 7.5V14.5C18 15.6046 17.1046 16.5 16 16.5H4C2.89543 16.5 2 15.6046 2 14.5V5.5Z"
      fill="currentColor"
    />
  </svg>`;
    folderIcon.className = 'w-4 h-4 flex-shrink-0';
    return [
      'span',
      {
        'data-type': node.attrs.type,
        'data-id': node.attrs.id,
        'data-first': node.attrs.isFirst,
        'data-display': node.attrs.display,
        class:
          'prosemirror-tag-node inline-flex gap-1 h-[22px] items-center align-bottom bg-bg-base border border-bg-border rounded px-1',
      },
      isDir
        ? folderIcon
        : [
            'span',
            {
              class: `text-left w-4 h-4 file-icon flex-shrink-0 inline-flex items-center ${
                icons.getClassWithColor(
                  (node.attrs.type === 'lang'
                    ? node.attrs.display.includes(' ')
                      ? '.txt'
                      : getFileExtensionForLang(node.attrs.display, true)
                    : node.attrs.display) || '.txt',
                ) || icons.getClassWithColor('index.txt')
              }`,
            },
            '',
          ],
      node.attrs.type === 'lang'
        ? node.attrs.display
        : isDir
        ? splitPath(node.attrs.display).slice(-2)[0]
        : splitPath(node.attrs.display).pop(),
    ];
  },

  parseDOM: [
    {
      // match tag with following CSS Selector
      tag: 'span[data-type][data-id][data-first][data-display]',

      getAttrs: (dom) => {
        const id = (dom as HTMLElement).getAttribute('data-id');
        const type = (dom as HTMLElement).getAttribute('data-type');
        const isFirst = (dom as HTMLElement).getAttribute('data-first');
        const display = (dom as HTMLElement).getAttribute('data-display');
        return {
          id,
          type,
          isFirst,
          display,
        };
      },
    },
  ],
};
