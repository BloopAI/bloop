import * as icons from 'file-icons-js';
import { type AttributeSpec, type NodeSpec } from 'prosemirror-model';

export const mentionNode: NodeSpec = {
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
        'data-mention': node.attrs.tag,
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
      tag: 'span[data-mention]',

      getAttrs: (dom) => {
        const tag = (dom as HTMLElement).getAttribute('data-mention');
        return {
          tag: tag,
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
