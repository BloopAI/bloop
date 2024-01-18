import { SymbolType, Range, TokenInfoType } from './results';
import {
  DiffChunkType,
  DiffHunkType,
  RepoType,
  StudioContextDoc,
  StudioContextFile,
} from './general';

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
  is_dir: boolean;
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
    indexed: boolean;
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
  indexed: boolean;
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

export type ConversationShortType = {
  created_at: number;
  id: string;
  title: string;
  thread_id: string;
};

export type AllConversationsResponse = ConversationShortType[];

type ProcStep = {
  type: 'proc';
  content: { query: string; paths: { repo: string; path: string }[] };
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
  thread_id: string;
  exchanges: ConversationExchangeType[];
};

export type ConversationExchangeType = {
  id: string;
  search_steps: SearchStepType[];
  query: {
    raw_query: string;
    repos: {
      Plain: { start: number; end: number; content: string };
    }[];
    paths: {
      Plain: { start: number; end: number; content: string };
    }[];
    langs: {
      Plain: {
        start: number;
        end: number;
        content: string;
      };
    }[];
    branch: {
      Plain: {
        start: number;
        end: number;
        content: string;
      };
    }[];
    target: {
      Plain: {
        start: number;
        end: number;
        content: string;
      };
    };
  };
  conclusion: string;
  answer: string;
  paths: string[];
  response_timestamp: string;
  focused_chunk: {
    repo_path: { repo: string; path: string };
    start_line: number;
    end_line: number;
  } | null;
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
  doc_context: StudioContextDoc[];
  token_counts: {
    total: number;
    per_file: (number | null)[];
    per_doc_file: (number | null)[];
    messages: number;
  };
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
  id: string;
  name: string;
  content: string;
  modified_at: string;
  is_default: boolean;
};

export type HistoryConversationTurn = CodeStudioType & {
  id: number;
  modified_at: string;
};

export type TutorialQuestionType = {
  tag: string;
  question: string;
};

export type DocShortType = {
  id: string;
  name: string;
  url: string;
  favicon: string;
  index_status: string;
};

export type DocPageType = {
  doc_id: number;
  doc_source: string;
  relative_url: string;
  absolute_url: string;
  doc_title: string;
};

export type DocSectionType = {
  ancestry: string[];
  doc_id: number;
  doc_source: string;
  doc_title: string;
  header: string;
  point_id: string;
  relative_url: string;
  absolute_url: string;
  section_range: { start: number; end: number };
  text: string;
};

export type GeneratedCodeDiff = {
  chunks: DiffChunkType[];
};

export type ProjectShortType = {
  id: string;
  name: string;
  modified_at: null | string;
  most_common_langs: string[];
};

export type ProjectFullType = ProjectShortType & {
  repos: { repo: RepoType; branch: string }[];
  studios: CodeStudioType[];
  conversations: ConversationShortType[];
  docs: DocShortType[];
};
