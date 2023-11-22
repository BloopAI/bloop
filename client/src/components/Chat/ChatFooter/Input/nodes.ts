import * as icons from 'file-icons-js';
import { type AttributeSpec, type NodeSpec } from 'prosemirror-model';
import { getFileExtensionForLang } from '../../../../utils';

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
    return [
      'span',
      {
        'data-type': node.attrs.type,
        'data-id': node.attrs.id,
        'data-first': node.attrs.isFirst,
        'data-display': node.attrs.display,
        class:
          'prosemirror-tag-node inline-flex gap-1.5 items-center align-bottom',
      },
      [
        'span',
        {
          class: `text-left w-4 h-4 file-icon flex-shrink-0 inline-flex items-center ${icons.getClassWithColor(
            (node.attrs.type === 'lang'
              ? node.attrs.display.includes(' ')
                ? '.txt'
                : getFileExtensionForLang(node.attrs.display, true)
              : node.attrs.display) || '.txt',
          )}`,
        },
        '',
      ],
      node.attrs.display,
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

export const tagNode: NodeSpec = {
  group: 'inline',
  inline: true,
  atom: true,

  attrs: {
    tag: '' as AttributeSpec,
  },

  selectable: false,
  draggable: false,

  toDOM: (node) => {
    return [
      'span',
      {
        'data-tag': node.attrs.tag,
        class:
          'prosemirror-tag-node file-icon inline-flex items-center flex-shrink-0 align-middle ' +
          icons.getClassWithColor(node.attrs.tag),
      },
      node.attrs.tag,
    ];
  },

  parseDOM: [
    {
      // match tag with following CSS Selector
      tag: 'span[data-tag]',

      getAttrs: (dom) => {
        const tag = (dom as HTMLElement).getAttribute('data-tag');
        return {
          tag: tag,
        };
      },
    },
  ],
};
