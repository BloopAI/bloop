import { FileTreeFileType, RepositoryFile } from './index';

export type BaseSymbolType =
  | 'method'
  | 'variable'
  | 'field'
  | 'typeParameter'
  | 'constant'
  | 'class'
  | 'interface'
  | 'struct'
  | 'event'
  | 'operator'
  | 'module'
  | 'property'
  | 'enum'
  | 'reference'
  | 'keyword'
  | 'file'
  | 'folder'
  | 'color'
  | 'unit'
  | 'snippet'
  | 'text';

export type ExtendedSymbolType =
  | 'function'
  | 'constructor'
  | 'value'
  | 'parameter'
  | 'generator'
  | 'const'
  | 'var'
  | 'type'
  | 'enumerator'
  | 'union'
  | 'typedef'
  | 'alias'
  | 'label'
  | 'member'
  | 'func';

export type SymbolType = BaseSymbolType | ExtendedSymbolType | 'multiple';

export enum ResultItemType {
  CODE,
  REPO,
  FILE,
  FLAG,
  LANG,
}

export type BaseResultType = {
  type: ResultItemType;
  id: number | string;
  repoName: string;
};

export interface CodeResult extends BaseResultType {
  relativePath: string;
  repoPath: string;
  branch: string;
  code: string;
  snippets: Snippet[];
  type: ResultItemType.CODE;
  language: string;
}

export interface FlagResult {
  type: ResultItemType.FLAG;
  data: string;
}

export interface LangResult {
  type: ResultItemType.LANG;
  data: string;
}

export interface RepoResult extends BaseResultType {
  repository: string;
  branches: number;
  files: number;
  type: ResultItemType.REPO;
  highlights: Range[];
}

export interface FileResult extends BaseResultType {
  relativePath: string;
  repoPath: string;
  lines: number;
  highlights: Range[];
  type: ResultItemType.FILE;
  language: string;
}

export interface SnippetSymbol {
  line: number;
  kind: SymbolType;
}

export interface Snippet {
  code: string;
  lineStart?: number;
  highlights?: Range[];
  symbols?: SnippetSymbol[];
}

export type Range = { start: number; end: number };

export type ResultType = CodeResult | RepoResult | FileResult;
export type SuggestionType = ResultType | FlagResult | LangResult;

export type FullResult = {
  relativePath: string;
  repoPath: string;
  code: string;
  language: string;
  hoverableRanges: Record<number, Range[]>;
  repoName: string;
  fileTree?: FileTreeItem[];
};

export type DirectoryResult = {
  name: string;
  entries: {
    name: string;
    path: string;
    type: FileTreeFileType;
    lang?: string;
  }[];
  relativePath: string;
};

export type TokenInfoItem = {
  code: string;
  line: number;
};

export type TokenInfoFile = {
  path: string;
  items: TokenInfoItem[];
};

export type TokenInfo = {
  references?: TokenInfoFile[];
  definitions?: TokenInfoFile[];
};

export type ResultClick = (
  repo: string,
  path?: string,
  lineNumbers?: [number, number],
) => void;

export type FileTreeItem = RepositoryFile & {
  children: FileTreeItem[];
  selected?: boolean;
};
