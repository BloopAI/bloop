import * as icons from 'file-icons-js';
import { type AttributeSpec, type NodeSpec } from 'prosemirror-model';

export const mentionNode: NodeSpec = {
  group: 'inline',
  inline: true,
  atom: true,

  attrs: {
    id: '' as AttributeSpec,
    name: '' as AttributeSpec,
    email: '' as AttributeSpec,
  },

  selectable: false,
  draggable: false,

  toDOM: (node) => {
    return [
      'span',
      {
        'data-mention-id': node.attrs.id,
        'data-mention-name': node.attrs.name,
        'data-mention-email': node.attrs.email,
        class: 'prosemirror-mention-node',
      },
      '@' + node.attrs.name || node.attrs.email,
    ];
  },

  parseDOM: [
    {
      // match tag with following CSS Selector
      tag: 'span[data-mention-id][data-mention-name][data-mention-email]',

      getAttrs: (dom) => {
        const id = (dom as HTMLElement).getAttribute('data-mention-id');
        const name = (dom as HTMLElement).getAttribute('data-mention-name');
        const email = (dom as HTMLElement).getAttribute('data-mention-email');
        return {
          id: id,
          name: name,
          email: email,
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
