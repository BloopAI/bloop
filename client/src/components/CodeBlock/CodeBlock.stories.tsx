import { MemoryRouter } from 'react-router-dom';
import { Snippet, SymbolType } from '../../types/results';
import CodeBlockSearch from './Search/index';
import SearchRepo from './SearchRepo';
import SearchFile from './SearchFile';
import SemanticSearch from './SemanticSearch';

export default {
  title: 'components/CodeBlockSearch',
  component: CodeBlockSearch,
};

export const CodeBlockMultipleMatches = () => {
  const snippets = [
    {
      code: `listen(_: unknown, event: string, arg?: any): Event<any> {\n switch (event) {\n  default: throw new Error('no apples');\n }\n}`,
      lineStart: 32,
    },
    {
      code: `client2.registerChannel('client2', {\n call(_: unknown, command: string, arg: any, cancellationToken: CancellationToken): Promise<any> {\n   switch (command) {\n    case 'testMethodClient2': return Promise.resolve('success2');\n    default: return Promise.reject(new Error('no apples'));\n   }\n }\n}`,
      lineStart: 211,
    },
    {
      code: `client2.registerChannel('client2', {\n call(_: unknown, command: string, arg: any, cancellationToken: CancellationToken): Promise<any> {\n   switch (command) {\n    case 'testMethodClient2': return Promise.resolve('success2');\n    default: return Promise.reject(new Error('no apples'));\n   }\n }\n}`,
      lineStart: 325,
    },
  ];
  return (
    <MemoryRouter initialEntries={['']}>
      <div style={{ width: 1000, backgroundColor: '', padding: '10px' }}>
        <CodeBlockSearch
          snippets={snippets}
          language={'typescript'}
          branch="test"
          filePath="src/components/main/index.js"
          repoName={'bloop'}
          repoPath={'Users/bloop/Project'}
        />
      </div>
    </MemoryRouter>
  );
};

export const CodeBlockSingleMatch = () => {
  const snippets = [
    {
      code: `client2.registerChannel('client2', {\n call(_: unknown, command: string, arg: any, cancellationToken: CancellationToken): Promise<any> {\n   switch (command) {\n    case 'testMethodClient2': return Promise.resolve('success2');\n    default: return Promise.reject(new Error('no apples'));\n   }\n }\n}`,
      lineStart: 211,
    },
  ];
  return (
    <MemoryRouter initialEntries={['']}>
      <div style={{ width: 1000, backgroundColor: '', padding: '10px' }}>
        <CodeBlockSearch
          snippets={snippets}
          language={'typescript'}
          branch="test"
          filePath="src/components/main/index.js"
          repoName={'bloop'}
          repoPath={'Users/bloop/Project'}
        />
      </div>
    </MemoryRouter>
  );
};

export const CodeBlockHighlighted = () => {
  const snippets: Snippet[] = [
    {
      code: `\n  React.useEffect(() => {\n    setSelected(expand);\n`,
      highlights: [{ start: 9, end: 18 }],
    },
    {
      code: `import { ChangeEvent, useCallback, useEffect, useState } from 'react';\nimport TextInput from '../TextInput';\n`,
      highlights: [{ start: 35, end: 44 }],
    },
    {
      code: `import React, { useCallback, useEffect, useState } from 'react'-abc;\nimport Step0 from './Step0';\n`,
      highlights: [
        { start: 29, end: 31 },
        { start: 40, end: 43 },
      ],
    },
    {
      code: `        ]\n        return items.filter<NavDropdownItem>((item): item is NavDropdownItem => !!item)\n    }, [searchContextsEnabled, showSearchContext])\n",`,
      highlights: [{ start: 25, end: 37 }],
    },
    {
      code: `import React from 'react';\nimport logo from './logo.svg';\n`,
      highlights: [{ start: 19, end: 24 }],
    },
    {
      code: `\n  useEffect(() => {\n    setFilteredItems(items.filter((i) => i.label.includes(filter)));\n`,
      highlights: [{ start: 3, end: 12 }],
    },
    {
      code: `) {\n  React.useEffect(\n    () => {\n`,
      highlights: [{ start: 12, end: 21 }],
    },
    {
      code: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n`,
      highlights: [{ start: 49, end: 65 }],
    },
  ];
  return (
    <MemoryRouter initialEntries={['']}>
      <div style={{ width: 1000, backgroundColor: '', padding: '10px' }}>
        <CodeBlockSearch
          snippets={snippets}
          language={'typescript'}
          branch="test"
          filePath="src/components/main/index.js"
          repoName={'bloop'}
          repoPath={'Users/bloop/Project'}
        />
      </div>
    </MemoryRouter>
  );
};

export const CodeBlockSymbolSearch = () => {
  const snippets: Snippet[] = [
    {
      code: `client2.registerChannel('client2', {\n call(_: unknown, command: string, arg: any, cancellationToken: CancellationToken): Promise<any> {\n   switch (command) {\n    case 'testMethodClient2': return Promise.resolve('success2');\n    default: return Promise.reject(new Error('no apples'));\n   }\n }\n}`,
      lineStart: 211,
      symbols: [{ kind: 'function' as SymbolType, line: 212 }],
      highlights: [{ start: 38, end: 42 }],
    },
  ];

  return (
    <MemoryRouter initialEntries={['']}>
      <div style={{ width: 1000, backgroundColor: '', padding: '10px' }}>
        <CodeBlockSearch
          snippets={snippets}
          language={'typescript'}
          branch="test"
          filePath="src/components/main/index.js"
          repoName={'bloop'}
          repoPath={'Users/bloop/Project'}
        />
      </div>
    </MemoryRouter>
  );
};

export const CodeBlockSymbolSearchCollapsed = () => {
  const snippets = [
    {
      code: `listen(_: unknown, event: string, arg?: any): Event<any> {`,
      lineStart: 32,
      symbols: [{ kind: 'function' as SymbolType, line: 32 }],
      highlights: [{ start: 0, end: 6 }],
    },
    {
      code: ` call(_: unknown, command: string, arg: any, cancellationToken: CancellationToken): Promise<any> {`,
      lineStart: 211,
      symbols: [{ kind: 'function' as SymbolType, line: 211 }],
      highlights: [{ start: 1, end: 5 }],
    },
  ];
  return (
    <MemoryRouter initialEntries={['']}>
      <div style={{ width: 1000, backgroundColor: '', padding: '10px' }}>
        <CodeBlockSearch
          snippets={snippets}
          language={'typescript'}
          branch="test"
          filePath="src/components/main/index.js"
          collapsed
          repoName={'bloop'}
          repoPath={'Users/bloop/Project'}
        />
      </div>
    </MemoryRouter>
  );
};

export const CodeSearchPath = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <div style={{ width: 1000 }} className="flex flex-col gap-4">
        <SearchFile
          filePath={'cobra-ats/src/javascript/app.js'}
          highlights={[{ start: 12, end: 15 }]}
          lines={12}
          repoName={'bloop'}
          onFileClick={() => {}}
        />
      </div>
    </MemoryRouter>
  );
};

export const CodeSearchRepo = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <div style={{ width: 1000 }} className="flex flex-col gap-4">
        <SearchRepo
          repository="cobra-ats"
          highlights={[{ start: 12, end: 15 }]}
        />
      </div>
    </MemoryRouter>
  );
};

export const SemanticSearchSnippets = () => {
  return (
    <div style={{ width: 1000 }} className="flex flex-col gap-4">
      <SemanticSearch
        snippets={[
          {
            line: 1,
            code: 'console.log("Hello world!");',
            path: 'src/index.js',
            repoName: 'bloop',
            lang: 'JavaScript',
          },
        ]}
        // nlQuery="Some nice answer"
        onClick={(e) => {
          // e.preventDefault();
        }}
      />
    </div>
  );
};
