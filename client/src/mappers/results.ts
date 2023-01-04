import {
  CodeItem,
  DirectoryEntry,
  DirectoryItem,
  FileItem,
  FileResItem,
  RangeLine,
  RepoItem,
  SuggestionsResponse,
  TokenInfoItem,
  TokenInfoResponse,
} from '../types/api';
import {
  CodeResult,
  FileResult,
  Range,
  RepoResult,
  ResultItemType,
  ResultType,
  TokenInfo,
  TokenInfoFile,
} from '../types/results';
import { FileTreeFileType } from '../types';
import { sortFiles } from '../utils/file';

const mapRepoResults = (item: RepoItem, id: number): RepoResult => {
  return {
    type: ResultItemType.REPO,
    id,
    branches: 0,
    files: 0,
    repository: item.data.name.text,
    highlights: item.data.name.highlights,
    repoName: item.data.name.text,
  };
};

const mapCodeResults = (item: CodeItem, id: number): CodeResult => {
  return {
    type: ResultItemType.CODE,
    branch: '',
    code: '',
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
    repoPath: item.data.repo_ref.replace('local/', ''),
    id,
    repoName: item.data.repo_name,
  };
};

const mapFileResults = (item: FileResItem, id: number): FileResult => {
  return {
    relativePath: item.data.relative_path.text,
    type: ResultItemType.FILE,
    lines: 0,
    repoPath: item.data.repo_ref.replace('local/', ''),
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

export const mapDirResult = (directoryItem: DirectoryItem) => {
  return {
    name: directoryItem.data.repo_name,
    entries: mapFileTree(
      directoryItem.data.entries,
      directoryItem.data.relative_path,
    ),
    relativePath: directoryItem.data.relative_path,
    repoRef: directoryItem.data.repo_ref,
  };
};

const mapFileTree = (siblings: DirectoryEntry[], relativePath: string) => {
  return siblings
    .map((item) => ({
      type:
        item.entry_data === 'Directory'
          ? FileTreeFileType.DIR
          : FileTreeFileType.FILE,
      path: `${relativePath}${item.name}`,
      name:
        item.entry_data === 'Directory'
          ? item.name.substring(item.name.length - 1, -1)
          : item.name,
      lang:
        item.entry_data !== 'Directory' ? item.entry_data.File.lang : undefined,
      children: [],
      selected: item.currentFile,
    }))
    .sort(sortFiles);
};

export const mapFileResult = (fileItem: FileItem) => {
  return {
    language: fileItem.data.lang,
    repoPath: fileItem.data.repo_ref,
    relativePath: fileItem.data.relative_path,
    code: fileItem.data.contents,
    hoverableRanges: [],
    repoName: fileItem.data.repo_name,
    fileTree: mapFileTree(
      fileItem.data.siblings || [],
      fileItem.data.relative_path,
    ),
  };
};

const mapTokenInfo = (tokenInfoItem: TokenInfoItem[]): TokenInfoFile[] => {
  return tokenInfoItem?.map((definition) => {
    return {
      path: definition.file,
      items: definition.data.map((item) => ({
        code: item.snippet.data.replace('\n', '').trim(),
        line: item.start.line,
      })),
    };
  });
};

export const mapTokenInfoData = (tokenInfo: TokenInfoResponse): TokenInfo => {
  return {
    definitions: tokenInfo.definitions
      ? mapTokenInfo(tokenInfo.definitions)
      : [],
    references: tokenInfo.references ? mapTokenInfo(tokenInfo.references) : [],
  };
};
