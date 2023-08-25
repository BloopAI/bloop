import { SymbolType, Range, TokenInfoType } from './results';
import { StudioContextFile } from './general';

export interface RangeLine {
  byte: number;
  column: number;
  line: number;
}

export interface SearchResponseStats {
  lang?: Record<string, number>;
  repo?: Record<string, number>;
  org?: Record<string, number>;
}

export interface SearchResponse {
  count?: number;
  data: (CodeItem | RepoItem | FileResItem | DirectoryItem | FileItem)[];
  stats: SearchResponseStats;
  metadata: {
    page?: number;
    page_size?: number;
    page_count?: number;
    total_count?: number;
  };
}
export interface FileSearchResponse extends SearchResponse {
  data: FileItem[];
}

export interface GeneralSearchResponse extends SearchResponse {
  data: (CodeItem | RepoItem | FileResItem)[];
}

export interface DirectorySearchResponse extends SearchResponse {
  data: DirectoryItem[];
}

export interface SymbolSnippetItem {
  kind: SymbolType;
  range: {
    start: RangeLine;
    end: RangeLine;
  };
}

export interface SnippetItem {
  data: string;
  highlights: Range[];
  symbols: SymbolSnippetItem[];
  line_range: Range;
}

export interface Snippet {
  relative_path: string;
  repo_name: string;
  repo_ref: string;
  lang: string;
  snippets: SnippetItem[];
}

export interface RepoFileNameItem {
  text: string;
  highlights: Range[];
}

export interface Repository {
  name: RepoFileNameItem;
  repo_ref: string;
}

export interface SearchResponseFile {
  relative_path: RepoFileNameItem;
  repo_name: string;
  repo_ref: string;
  lang: string;
}

export interface FlagItem {
  kind: 'flag';
  data: string;
}

export interface LangItem {
  kind: 'lang';
  data: string;
}

export interface CodeItem {
  kind: 'snippets';
  data: Snippet;
}

export interface RepoItem {
  kind: 'repository_result';
  data: Repository;
}

export interface FileResItem {
  kind: 'file_result';
  data: SearchResponseFile;
}

export interface DirectoryItem {
  kind: 'dir';
  data: Directory;
}

export interface FileItem {
  kind: 'file';
  data: File;
}

export interface Directory {
  repo_name: string;
  relative_path: string;
  repo_ref: string;
  entries: DirectoryEntry[];
}

export interface DirectoryFileEntryData {
  File: {
    lang: string;
  };
}

export interface DirectoryEntry {
  name: string;
  entry_data: 'Directory' | DirectoryFileEntryData;
}

export interface File {
  repo_name: string;
  relative_path: string;
  lang: string;
  contents: string;
  repo_ref: string;
  siblings: DirectoryEntry[];
  size: number;
  loc: number;
  sloc: number;
}

export interface FileResponse {
  contents: string;
  lang: string;
}

export interface FiltersItem {
  name: string;
  count: number;
}

export interface FiltersResponse {
  repos: FiltersItem[];
  paths: FiltersItem[];
  commits: FiltersItem[];
  languages: FiltersItem[];
}

export interface HoverablesResponse {
  ranges: {
    start: { byte: number; line: number; column: number };
    end: { byte: number; line: number; column: number };
  }[];
}

interface RangeWithLine extends Range {
  line: number;
}
export interface TokenInfoSnippet {
  data: string;
  highlights: Range[];
  symbols: [];
  line_range: Range;
}

export interface TokenInfoDataItem {
  start: RangeLine;
  end: RangeLine;
  snippet: TokenInfoSnippet;
}

export interface TokenInfoItem {
  file: string;
  data: TokenInfoDataItem[];
}

export type RefDefDataItem = {
  kind: TokenInfoType;
  range: {
    start: {
      byte: number;
      line: number;
      column: number;
    };
    end: {
      byte: number;
      line: number;
      column: number;
    };
  };
  snippet: {
    data: string;
    highlights: Range[];
    tokenRange?: Range;
    symbols: never[];
    line_range: Range;
  };
};

export interface TokenInfoResponse {
  data: {
    file: string;
    data: RefDefDataItem[];
  }[];
}

export type AllConversationsResponse = {
  created_at: number;
  thread_id: string;
  title: string;
}[];

type ProcStep = {
  type: 'proc';
  content: { query: string; paths: string[] };
};

type CodeStep = {
  type: 'code';
  content: { query: string };
};

type PathStep = {
  type: 'path';
  content: { query: string };
};

export type SearchStepType = ProcStep | CodeStep | PathStep;

export type ConversationType = {
  id: string;
  search_steps: SearchStepType[];
  query: { target: { Plain: string } };
  conclusion: string;
  answer: string;
  paths: string[];
  response_timestamp: string;
  focused_chunk: { file_path: string } | null;
};

export type CodeStudioMessageType =
  | {
      User: string;
    }
  | { Assistant: string };

export type CodeStudioType = {
  id: string;
  name: string;
  modified_at: string;
  messages: CodeStudioMessageType[];
  context: StudioContextFile[];
  token_counts: { total: number; per_file: [] };
};

export interface SuggestionsResponse {
  count: number;
  data: (
    | CodeItem
    | FlagItem
    | FileResItem
    | RepoItem
    | DirectoryItem
    | FileItem
    | LangItem
  )[];
}

export interface NLSnippet {
  repo_name: string;
  relative_path: string;
  text: string;
  lang: string;
  start_line: number;
}

export interface NLSearchResponse {
  query_id: string;
  answer_path: string;
  snippets: NLSnippet[];
  user_id: string;
}

export type StudioTemplateType = {
  name: string;
  body: string;
};

export type HistoryConversationTurn = {
  messages: (CodeStudioMessageType & { timestamp: string })[];
};
