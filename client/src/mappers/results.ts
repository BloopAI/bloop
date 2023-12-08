import {
  CodeItem,
  File,
  FileItem,
  FileResItem,
  RangeLine,
  RefDefDataItem,
  RepoItem,
  SuggestionsResponse,
  TokenInfoResponse,
} from '../types/api';
import {
  CodeResult,
  FileResult,
  Range,
  RepoResult,
  ResultItemType,
  ResultType,
} from '../types/results';

const mapRepoResults = (item: RepoItem, id: number): RepoResult => {
  return {
    type: ResultItemType.REPO,
    id,
    branches: 0,
    files: 0,
    highlights: item.data.name.highlights,
    repoName: item.data.name.text,
    repoRef: item.data.repo_ref,
  };
};

const mapCodeResults = (item: CodeItem, id: number): CodeResult => {
  return {
    type: ResultItemType.CODE,
    snippets: item.data.snippets.map((snippet) => ({
      code: snippet.data,
      lineStart: snippet.line_range.start,
      highlights: snippet.highlights.map((highlight) => ({
        start: highlight.start,
        end: highlight.end,
      })),
      symbols: snippet.symbols.map((symbol) => ({
        kind: symbol.kind,
        line: symbol.range.start.line,
      })),
    })),
    language: item.data.lang,
    relativePath: item.data.relative_path,
    repoRef: item.data.repo_ref,
    id,
    repoName: item.data.repo_name,
  };
};

const mapFileResults = (item: FileResItem, id: number): FileResult => {
  return {
    relativePath: item.data.relative_path.text,
    type: ResultItemType.FILE,
    lines: 0,
    repoRef: item.data.repo_ref,
    id,
    language: item.data.lang,
    highlights: item.data.relative_path.highlights,
    repoName: item.data.repo_name,
  };
};

export const mapResults = (data: SuggestionsResponse): ResultType[] => {
  if (data.count === 0) {
    return [];
  }

  return data.data
    .map((item, id) => {
      switch (item.kind) {
        case 'snippets':
          return mapCodeResults(item, id);
        case 'file_result':
          return mapFileResults(item, id);
        case 'repository_result':
          return mapRepoResults(item, id);
        case 'flag':
          return { type: ResultItemType.FLAG, ...item };
        case 'lang':
          return { type: ResultItemType.LANG, ...item };
      }
    })
    .filter(Boolean) as ResultType[];
};

export const mapRanges = (
  data: {
    start: RangeLine;
    end: RangeLine;
  }[],
): Record<number, Range[]> => {
  const res: Record<number, Range[]> = {};
  data.forEach((item) => {
    if (!res[item.start.line]) {
      res[item.start.line] = [];
    }
    res[item.start.line].push({ start: item.start.byte, end: item.end.byte });
  });
  return res;
};

export const mapTokenInfo = (
  tokenInfo: TokenInfoResponse['data'],
  path: string,
) => {
  const map: {
    references: Record<string, any>;
    definitions: Record<string, any>;
  } = {
    references: [],
    definitions: [],
  };
  const mapItem = (td: RefDefDataItem) => {
    const trimmed = td.snippet.data.trimStart();
    const lengthDiff = td.snippet.data.length - trimmed.length;
    return {
      ...td,
      snippet: {
        ...td.snippet,
        data: trimmed,
        highlights: td.snippet.highlights.map((h) => {
          return { start: h.start - lengthDiff, end: h.end - lengthDiff };
        }),
        tokenRange: td.snippet.highlights[0],
      },
    };
  };
  tokenInfo.forEach((t) => {
    const references = t.data.filter((d) => d.kind === 'reference');
    if (references.length) {
      map.references[t.file] = [
        ...(map.references[t.file] || []),
        ...references.map(mapItem),
      ];
    }
    const definitions = t.data.filter((d) => d.kind === 'definition');
    if (definitions.length) {
      map.definitions[t.file] = [
        ...(map.definitions[t.file] || []),
        ...definitions.map(mapItem),
      ];
    }
  });

  const arrayFromObject = (obj: Record<string, any>) =>
    Object.entries(obj)
      .map(([file, data]) => ({
        file,
        data,
      }))
      .sort((a, b) => (a.file === path ? -1 : b.file === path ? 1 : 0));

  return {
    references: arrayFromObject(map.references),
    definitions: arrayFromObject(map.definitions),
  };
};
