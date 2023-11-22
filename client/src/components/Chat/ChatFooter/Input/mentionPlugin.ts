import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { ResolvedPos } from 'prosemirror-model';

export function getRegexp(
  mentionTrigger: string,
  hashtagTrigger: string,
  allowSpace?: boolean,
) {
  const mention = allowSpace
    ? new RegExp('(^|\\s)' + mentionTrigger + '([\\w-\\+]+\\s?[\\w-\\+]*)$')
    : new RegExp('(^|\\s)' + mentionTrigger + '([\\w-\\+]+)$');

  // hashtags should never allow spaces. I mean, what's the point of allowing spaces in hashtags?
  const tag = new RegExp('(^|\\s)' + hashtagTrigger + '([\\w-]+)$');

  return {
    mention: mention,
    tag: tag,
  };
}

export function getMatch(
  $position: ResolvedPos,
  opts: {
    mentionTrigger: string;
    hashtagTrigger: string;
    allowSpace?: boolean;
  },
) {
  // take current para text content upto cursor start.
  // this makes the regex simpler and parsing the matches easier.
  const parastart = $position.before();
  const text = $position.doc.textBetween(parastart, $position.pos, '\n', '\0');

  const regex = getRegexp(
    opts.mentionTrigger,
    opts.hashtagTrigger,
    opts.allowSpace,
  );

  // only one of the below matches will be true.
  const mentionMatch = text.match(regex.mention);
  const tagMatch = text.match(regex.tag);

  const match = mentionMatch || tagMatch;

  // set type of match
  let type;
  if (mentionMatch) {
    type = 'mention';
  } else if (tagMatch) {
    type = 'tag';
  }

  // if match found, return match with useful information.
  if (match) {
    // adjust match.index to remove the matched extra space
    match.index = match[0].startsWith(' ') ? match.index! + 1 : match.index;
    match[0] = match[0].startsWith(' ')
      ? match[0].substring(1, match[0].length)
      : match[0];

    // The absolute position of the match in the document
    const from = $position.start() + match.index!;
    const to = from + match[0].length;

    const queryText = match[2];

    return {
      range: { from: from, to: to },
      queryText: queryText,
      type: type,
    };
  }
  // else if no match don't return anything.
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
    type: '', //mention or tag
    text: '',
    suggestions: [],
    index: 0, // current active suggestion index
  };
};

type Options = {
  mentionTrigger: string;
  hashtagTrigger: string;
  allowSpace?: boolean;
  activeClass: string;
  suggestionTextClass?: string;
  getSuggestions: (
    type: string,
    text: string,
    done: (s: Record<string, string>[]) => void,
  ) => void;
  delay: number;
  getSuggestionsHTML: (items: Record<string, string>[], type: string) => string;
};
/**
 * @param {JSONObject} opts
 * @returns {Plugin}
 */
export function getMentionsPlugin(opts: Partial<Options>) {
  // default options
  const defaultOpts = {
    mentionTrigger: '@',
    hashtagTrigger: '#',
    allowSpace: true,
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

  // current Idx
  let index = 0;

  // ----- methods operating on above properties -----

  const showList = function (
    view: EditorView,
    state: State,
    suggestions: Record<string, string>[],
    opts: Options,
  ) {
    el.innerHTML = opts.getSuggestionsHTML(suggestions, state.type);

    // attach new item event handlers
    el.querySelectorAll('.suggestion-item').forEach(function (itemNode, index) {
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
    });

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
    el.style.left = offset?.left + 'px';

    const bottom = window.innerHeight - (offset?.top || 0);
    el.style.bottom = bottom + 'px';
    el.style.display = 'block';
    el.style.zIndex = '999999';
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
    addClassAtIndex(state.index, opts.activeClass);
  };

  const goPrev = function (view: EditorView, state: State, opts: Options) {
    removeClassAtIndex(state.index, opts.activeClass);
    state.index--;
    state.index =
      state.index === -1 ? state.suggestions.length - 1 : state.index;
    addClassAtIndex(state.index, opts.activeClass);
  };

  const select = function (view: EditorView, state: State, opts: Options) {
    const item = state.suggestions[state.index];
    let attrs;
    if (state.type === 'mention') {
      attrs = {
        ...item,
      };
    } else {
      attrs = {
        tag: item.tag,
      };
    }
    const node = view.state.schema.nodes[state.type].create(attrs);
    const tr = view.state.tr.replaceWith(
      state.range.from,
      state.range.to,
      node,
    );

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
      },
    },

    // We'll need props to hi-jack keydown/keyup & enter events when suggestion dropdown
    // is active.
    props: {
      handleKeyDown(view, e) {
        const state = this.getState(view.state);

        // don't handle if no suggestions or not in active mode
        if (!state?.active && !state?.suggestions.length) {
          return false;
        }

        // if any of the below keys, override with custom handlers.
        let down, up, enter, esc;
        enter = e.keyCode === 13;
        down = e.keyCode === 40;
        up = e.keyCode === 38;
        esc = e.keyCode === 27;

        if (down) {
          goNext(view, state, options);
          return true;
        } else if (up) {
          goPrev(view, state, options);
          return true;
        } else if (enter) {
          select(view, state, options);
          return true;
        } else if (esc) {
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
          if (!state.text) {
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
      };
    },
  });
}