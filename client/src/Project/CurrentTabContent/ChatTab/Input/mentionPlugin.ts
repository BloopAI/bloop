import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { ResolvedPos } from 'prosemirror-model';
import { MentionOptionType } from '../../../../types/results';

export function getRegexp(mentionTrigger: string, allowSpace?: boolean) {
  return allowSpace
    ? new RegExp('(^|\\s)' + mentionTrigger + '([\\w-\\+]*\\s?[\\w-\\+.]*)$')
    : new RegExp('(^|\\s)' + mentionTrigger + '([\\w-\\+.]*)$');
}

const insertAfterSelect = String.fromCharCode(160);

export function getMatch(
  $position: ResolvedPos,
  opts: {
    mentionTrigger: string;
    allowSpace?: boolean;
  },
) {
  try {
    // take current para text content upto cursor start.
    // this makes the regex simpler and parsing the matches easier.
    const parastart = $position.before();
    const text = $position.doc.textBetween(
      parastart,
      $position.pos,
      '\n',
      '\0',
    );

    const regex = getRegexp(opts.mentionTrigger, opts.allowSpace);

    const match = text.match(regex);

    // if match found, return match with useful information.
    if (match) {
      // adjust match.index to remove the matched extra space
      match.index =
        match[0].startsWith(' ') || match[0].startsWith(insertAfterSelect)
          ? (match.index || 0) + 1
          : match.index;
      match[0] =
        match[0].startsWith(' ') || match[0].startsWith(insertAfterSelect)
          ? match[0].substring(1, match[0].length)
          : match[0];

      // The absolute position of the match in the document
      const from = $position.start() + match.index!;
      const to = from + match[0].length;

      const queryText = match[2];

      return {
        range: { from: from, to: to },
        queryText: queryText,
        type: 'mention',
      };
    }
    // else if no match don't return anything.
  } catch (e) {
    console.log(e);
  }
}

/**
 * Util to debounce call to a function.
 * >>> debounce(function(){}, 1000, this)
 */
export const debounce = (function () {
  let timeoutId: number;
  return function (func: () => void, timeout: number, context: any): number {
    // @ts-ignore
    context = context || this;
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(function () {
      // @ts-ignore
      func.apply(context, arguments);
    }, timeout);

    return timeoutId;
  };
})();

type State = {
  active: boolean;
  range: {
    from: number;
    to: number;
  };
  type: string;
  text: string;
  suggestions: Record<string, any>[];
  index: number;
};

const getNewState = function () {
  return {
    active: false,
    range: {
      from: 0,
      to: 0,
    },
    type: '',
    text: '',
    suggestions: [],
    index: 0, // current active suggestion index
  };
};

type Options = {
  mentionTrigger: string;
  allowSpace?: boolean;
  activeClass: string;
  suggestionTextClass?: string;
  getSuggestions: (
    type: string,
    text: string,
    done: (s: MentionOptionType[]) => void,
  ) => void;
  delay: number;
  getSuggestionsHTML: (items: MentionOptionType[], type: string) => string;
};

export function getMentionsPlugin(opts: Partial<Options>) {
  // default options
  const defaultOpts = {
    mentionTrigger: '@',
    allowSpace: false,
    getSuggestions: (
      type: string,
      text: string,
      cb: (s: { name: string }[]) => void,
    ) => {
      cb([]);
    },
    getSuggestionsHTML: (items: { name: string }[]) =>
      '<div class="suggestion-item-list">' +
      items
        .map((i) => '<div class="suggestion-item">' + i.name + '</div>')
        .join('') +
      '</div>',
    activeClass: 'suggestion-item-active',
    suggestionTextClass: 'prosemirror-suggestion',
    maxNoOfSuggestions: 10,
    delay: 500,
  };

  const options = Object.assign({}, defaultOpts, opts) as Options;

  // timeoutId for clearing debounced calls
  let showListTimeoutId: number;

  // dropdown element
  const el = document.createElement('div');

  const showList = function (
    view: EditorView,
    state: State,
    suggestions: MentionOptionType[],
    opts: Options,
  ) {
    try {
      el.innerHTML = opts.getSuggestionsHTML(suggestions, state.type);

      // attach new item event handlers
      el.querySelectorAll('.suggestion-item').forEach(
        function (itemNode, index) {
          itemNode.addEventListener('click', function () {
            select(view, state, opts);
            view.focus();
          });
          // TODO: setIndex() needlessly queries.
          // We already have the itemNode. SHOULD OPTIMIZE.
          itemNode.addEventListener('mouseover', function () {
            setIndex(index, state, opts);
          });
          itemNode.addEventListener('mouseout', function () {
            setIndex(index, state, opts);
          });
        },
      );

      // highlight first element by default - like Facebook.
      addClassAtIndex(state.index, opts.activeClass);

      // TODO: knock off domAtPos usage. It's not documented and is not officially a public API.
      // It's used currently, only to optimize the the query for textDOM
      const node = view.domAtPos(view.state.selection.$from.pos);
      const paraDOM = node.node;
      const textDOM = (paraDOM as HTMLElement).querySelector(
        '.' + opts.suggestionTextClass,
      );

      const offset = textDOM?.getBoundingClientRect();

      document.body.appendChild(el);
      el.classList.add('suggestion-item-container');
      el.style.position = 'fixed';
      el.style.left = -9999 + 'px';
      const offsetLeft = offset?.left || 0;
      const offsetTop = offset?.top || 0;
      setTimeout(() => {
        el.style.left =
          offsetLeft + el.clientWidth < window.innerWidth
            ? offsetLeft + 'px'
            : offsetLeft +
              (window.innerWidth - (offsetLeft + el.clientWidth) - 10) +
              'px';
        el.style.bottom =
          window.innerHeight - offsetTop + el.clientHeight > window.innerHeight
            ? window.innerHeight - offsetTop - el.clientHeight - 20 + 'px'
            : window.innerHeight - offsetTop + 'px';
      }, 10);

      el.style.display = 'block';
      el.style.zIndex = '80';
    } catch (e) {
      console.log(e);
    }
  };

  const hideList = function () {
    el.style.display = 'none';
  };

  const removeClassAtIndex = function (index: number, className: string) {
    const itemList = el.querySelector('.suggestion-item-list')?.childNodes;
    const prevItem = itemList?.[index];
    (prevItem as HTMLElement)?.classList.remove(className);
  };

  const addClassAtIndex = function (index: number, className: string) {
    const itemList = el.querySelector('.suggestion-item-list')?.childNodes;
    const prevItem = itemList?.[index];
    (prevItem as HTMLElement)?.classList.add(className);
    return prevItem as HTMLElement | undefined;
  };

  const setIndex = function (index: number, state: State, opts: Options) {
    removeClassAtIndex(state.index, opts.activeClass);
    state.index = index;
    addClassAtIndex(state.index, opts.activeClass);
  };

  const goNext = function (view: EditorView, state: State, opts: Options) {
    removeClassAtIndex(state.index, opts.activeClass);
    state.index++;
    state.index = state.index === state.suggestions.length ? 0 : state.index;
    const el = addClassAtIndex(state.index, opts.activeClass);
    el?.scrollIntoView({ block: 'nearest' });
  };

  const goPrev = function (view: EditorView, state: State, opts: Options) {
    removeClassAtIndex(state.index, opts.activeClass);
    state.index--;
    state.index =
      state.index === -1 ? state.suggestions.length - 1 : state.index;
    const el = addClassAtIndex(state.index, opts.activeClass);
    el?.scrollIntoView({ block: 'nearest' });
  };

  const select = function (view: EditorView, state: State, opts: Options) {
    const item = state.suggestions[state.index];
    const attrs = {
      ...item,
    };
    const node = view.state.schema.nodes[state.type].create(attrs);
    const spaceNode = view.state.schema.text(insertAfterSelect);

    const tr = view.state.tr.replaceWith(state.range.from, state.range.to, [
      node,
      spaceNode,
    ]);

    //var newState = view.state.apply(tr);
    //view.updateState(newState);
    view.dispatch(tr);
  };

  return new Plugin({
    key: new PluginKey('autosuggestions'),

    // we will need state to track if suggestion dropdown is currently active or not
    state: {
      init() {
        return getNewState();
      },

      apply(tr, state) {
        try {
          // compute state.active for current transaction and return
          const newState = getNewState();
          const selection = tr.selection;
          if (selection.from !== selection.to) {
            return newState;
          }

          const $position = selection.$from;
          const match = getMatch($position, options);

          // if match found update state
          if (match) {
            newState.active = true;
            newState.range = match.range;
            newState.type = match.type!;
            newState.text = match.queryText;
          }

          return newState;
        } catch (e) {
          console.log(e);
          return state;
        }
      },
    },

    // We'll need props to hi-jack keydown/keyup & enter events when suggestion dropdown
    // is active.
    props: {
      handleKeyDown(view, e) {
        const state = this.getState(view.state);

        if (!state?.active && !state?.suggestions.length) {
          return false;
        }

        if (e.key === 'ArrowDown') {
          e.stopPropagation();
          goNext(view, state, options);
          return true;
        } else if (e.key === 'ArrowUp') {
          e.stopPropagation();
          goPrev(view, state, options);
          return true;
        } else if (e.key === 'Enter') {
          e.stopPropagation();
          select(view, state, options);
          return true;
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          clearTimeout(showListTimeoutId);
          hideList();
          // @ts-ignore
          this.state = getNewState();
          return true;
        } else {
          // didn't handle. handover to prosemirror for handling.
          return false;
        }
      },

      // to decorate the currently active @mention text in ui
      decorations(editorState) {
        const { active, range } = this.getState(editorState) || {};

        if (!active || !range) return null;

        return DecorationSet.create(editorState.doc, [
          Decoration.inline(range.from, range.to, {
            nodeName: 'span',
            class: options.suggestionTextClass,
          }),
        ]);
      },
    },

    // To track down state mutations and add dropdown reactions
    view() {
      return {
        update: (view) => {
          const state = this.key?.getState(view.state);
          if (!state.active) {
            hideList();
            clearTimeout(showListTimeoutId);
            return;
          }
          // debounce the call to avoid multiple requests
          showListTimeoutId = debounce(
            function () {
              // get suggestions and set new state
              options.getSuggestions(
                state.type,
                state.text,
                function (suggestions) {
                  // update `state` argument with suggestions
                  state.suggestions = suggestions;
                  showList(view, state, suggestions, options);
                },
              );
            },
            options.delay,
            this,
          );
        },
        destroy: () => {
          hideList();
        },
      };
    },
  });
}
