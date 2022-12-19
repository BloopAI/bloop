import { GeneralSearchResponse } from '../types/api';

export const codeSearch: GeneralSearchResponse = {
  count: 19,
  data: [
    {
      kind: 'snippets' as any,
      data: {
        lang: 'TypeScript',
        name: {
          text: 'bloop',
          highlights: [],
        },
        repo_name: 'bloop',
        relative_path:
          'Users/users/bloop/enterprise-search/client/src/hooks/useOnClickOutsideHook.ts',
        repo_ref: '',
        snippets: [
          {
            highlights: [{ start: 12, end: 21 }],
            data: '',
            line_range: { start: 0, end: 0 },
            symbols: [],
          },
        ],
      },
    },
    {
      kind: 'snippets' as any,
      data: {
        lang: 'TypeScript',
        name: {
          text: 'bloop',
          highlights: [],
        },
        repo_name: 'bloop',
        relative_path:
          'Users/users/bloop/enterprise-search/client/src/hooks/useOnClickOutsideHook.ts',
        repo_ref: '',
        snippets: [
          {
            highlights: [{ start: 12, end: 21 }],
            data: '',
            line_range: { start: 0, end: 0 },
            symbols: [],
          },
        ],
      },
    },
    {
      kind: 'snippets' as any,
      data: {
        lang: 'TypeScript',
        name: {
          text: 'bloop',
          highlights: [],
        },
        repo_name: 'bloop',
        relative_path:
          'Users/users/bloop/enterprise-search/client/src/hooks/useOnClickOutsideHook.ts',
        repo_ref: '',
        snippets: [
          {
            highlights: [{ start: 12, end: 21 }],
            data: '',
            line_range: { start: 0, end: 0 },
            symbols: [],
          },
        ],
      },
    },
  ],
  metadata: {
    page: 0,
    page_count: 0,
    page_size: 0,
    total_count: 0,
  },
  stats: {
    repo: {},
    lang: {},
    org: {},
  },
};

export const fileContent = `import React from 'react';

export function useOnClickOutside(
  ref: React.MutableRefObject<HTMLElement | null>,
  handler: (e: MouseEvent) => void,
) {
  React.useEffect(
    () => {
      const listener = (event: MouseEvent) => {
        // Do nothing if clicking ref's element or descendent elements
        if (!ref?.current || ref.current.contains(event.target as Node)) {
          return;
        }
        handler(event);
      };
      document.addEventListener('mousedown', listener);
      return () => {
        document.removeEventListener('mousedown', listener);
      };
    },
    // Add ref and handler to effect dependencies
    // It's worth noting that because passed in handler is a new ...
    // ... function on every render that will cause this effect ...
    // ... callback/cleanup to run every render. It's not a big deal ...
    // ... but to optimize you can wrap handler in useCallback before ...
    // ... passing it into this hook.
    [ref, handler],
  );
}`;
