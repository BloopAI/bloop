import React, { ReactElement } from 'react';
import { DocShortType, SearchStepType } from './api';
import { RepoSource } from './index';

export enum MenuItemType {
  DEFAULT = 'default',
  LINK = 'link',
  SELECTABLE = 'selectable',
  REMOVABLE = 'removable',
  DANGER = 'danger',
}

export enum ExtendedMenuItemType {
  SHARED = 'shared',
  DIVIDER = 'divider',
  DIVIDER_WITH_TEXT = 'divider_with_text',
}

export type SearchHistoryType = {
  text: string;
  type: MenuItemType | ExtendedMenuItemType;
  icon?: React.ReactElement;
};

export enum FilterName {
  LANGUAGE = 'lang',
  ORGANISATION = 'org',
  REPOSITORY = 'repo',
  PATH = 'path',
}

export type FilterType = {
  title: string;
  items: {
    label: string;
    description: string;
    checked: boolean;
    icon?: ReactElement;
  }[];
  type: 'checkbox' | 'button';
  name: FilterName | string;
  singleSelect?: boolean;
  disabled?: boolean;
};

export enum SyncStatus {
  Cancelled = 'cancelled',
  Cancelling = 'cancelling',
  Uninitialized = 'uninitialized',
  Queued = 'queued',
  Done = 'done',
  Error = 'error',
  Removed = 'removed',
  Indexing = 'indexing',
  Syncing = 'syncing',
  RemoteRemoved = 'remote_removed',
}

export enum RepoProvider {
  GitHub = 'github',
  Local = 'local',
}

export type RepoType = {
  ref: string;
  name: string;
  provider: RepoProvider;
  local_duplicates: string[];
  last_update: string;
  last_index: string;
  sync_status: SyncStatus;
  most_common_lang: string;
  branches: { name: string; last_commit_unix_secs: number }[];
  branch_filter: { select: string[] } | null;
};

export type RepoUi = RepoType & {
  shortName: string;
  folderName: string;
  alreadySynced?: boolean;
};

export type CodeStudioShortType = {
  id: string;
  name: string;
  modified_at: string;
  repos: string[];
  most_common_ext: string;
};

export enum FullResultModeEnum {
  PAGE,
  SIDEBAR,
  MODAL,
}

export enum SearchType {
  REGEX,
  NL,
}

export enum TabType {
  REPO = 'repo',
  STUDIO = 'studio',
  HOME = 'home',
}

export type RepoTabType = {
  key: string;
  name: string;
  repoName: string;
  repoRef: string;
  source: RepoSource;
  branch?: string | null;
  navigationHistory: NavigationItem[];
  type: TabType.REPO;
};

export type HomeTabType = {
  key: string;
  name: string;
  type: TabType.HOME;
};

export type StudioTabType = {
  key: string;
  name: string;
  type: TabType.STUDIO;
};

export type UITabType = RepoTabType | HomeTabType | StudioTabType;

export type TabHistoryType = {
  tabKey: string;
  history: SearchHistoryItem[];
};

export enum ReposFilter {
  ALL,
  LOCAL,
  GITHUB,
}

export type SearchHistoryItem =
  | string
  | { query: string; searchType: SearchType; timestamp?: string };

export type ConversationMessage = {
  author: 'user' | 'server';
  text?: string;
  isLoading: boolean;
  snippets?: {
    path: string;
    code: string;
    repoName: string;
    lang: string;
    line: number;
  }[];
  error?: string;
};

export enum ChatMessageType {
  Answer = 'answer',
  Prompt = 'prompt',
}

export enum ChatMessageAuthor {
  User = 'user',
  Server = 'server',
}

export enum ParsedQueryTypeEnum {
  TEXT = 'text',
  PATH = 'path',
  LANG = 'lang',
  BRANCH = 'branch',
}
export type ParsedQueryType = { type: ParsedQueryTypeEnum; text: string };

export type ChatMessageUser = {
  author: ChatMessageAuthor.User;
  text: string;
  parsedQuery?: ParsedQueryType[];
  isFromHistory?: boolean;
};

export type MessageResultCite = {
  Cite: {
    path_alias?: number;
    path: string;
    comment: string;
    start_line: number;
    end_line: number;
  };
};

export type MessageResultDirectory = {
  Directory: {
    path: string | null;
    comment: string | null;
  };
};

export type MessageResultNew = {
  New: {
    language: string;
    code: string;
  };
};

export type MessageResultModify = {
  Modify: {
    path: string;
    language: string;
    diff: {
      header: {
        old_start: number;
        new_start: number;
        old_lines: number;
        new_lines: number;
      };
      lines: string[];
    };
  };
};

export type ChatLoadingStep = SearchStepType & {
  path: string;
  displayText: string;
};

export type FileSystemResult = {
  Filesystem?: (
    | MessageResultCite
    | MessageResultNew
    | MessageResultModify
    | MessageResultDirectory
  )[];
};

export type ArticleResult = {
  Article?: string;
};

export type ChatMessageServer = {
  author: ChatMessageAuthor.Server;
  text?: string;
  isLoading: boolean;
  loadingSteps: ChatLoadingStep[];
  error?: string;
  isFromHistory?: boolean;
  conclusion?: string;
  queryId: string;
  responseTimestamp: string;
  explainedFile?: string;
};

export type ChatMessage = ChatMessageUser | ChatMessageServer;

export type OpenChatHistoryItem = {
  conversation: ChatMessage[];
  threadId: string;
};

export interface NavigationItem {
  type:
    | 'search'
    | 'repo'
    | 'full-result'
    | 'home'
    | 'conversation-result'
    | 'article-response';
  query?: string;
  repo?: string;
  path?: string;
  page?: number;
  loaded?: boolean;
  isInitial?: boolean;
  searchType?: SearchType;
  pathParams?: Record<string, string>;
  threadId?: string;
  recordId?: number;
}

export type EnvConfig = {
  analytics_data_plane?: string;
  analytics_key_fe?: string;
  sentry_dsn_fe?: string;
  org_name?: string | null;
  tracking_id?: string;
  device_id?: string;
  user_login?: string;
  github_user?: {
    login: string;
    avatar_url: string;
  };
  bloop_user_profile?: {
    prompt_guide?: string;
    allow_session_recordings?: boolean;
  };
  credentials_upgrade?: boolean;
};

export type IpynbOutputType = {
  name?: string;
  stream?: string;
  ename?: string;
  evalue?: string;
  traceback?: string[];
  data?: {
    'text/plain'?: string[];
    'text/html'?: string[];
    'text/latex'?: string[];
    'image/png'?: string;
    'image/jpeg'?: string;
    'image/gif'?: string;
    'image/svg+xml'?: string;
    'application/javascript'?: string[];
  };
  output_type?: string;
  png?: string;
  jpeg?: string;
  gif?: string;
  svg?: string;
  html?: string;
  latex?: string;
  text?: string[];
  execution_count?: number;
  prompt_number?: number;
  metadata?: {
    scrolled?: boolean;
  };
};

export type IpynbCellType = {
  attachments?: {
    [s: string]: {
      [s: string]: string;
    };
  };
  cell_type?: string;
  language?: string;
  execution_count?: number | null;
  prompt_number?: number;
  auto_number?: number;
  level?: number;
  source?: string[];
  outputs?: IpynbOutputType[];
  input?: string[];
};

export type FileHighlightsType = Record<
  string,
  ({ lines: [number, number]; color: string; index: number } | undefined)[]
>;

export type LocaleType = 'en' | 'ja' | 'zhCN' | 'es' | 'it';

export enum StudioConversationMessageAuthor {
  USER = 'User',
  ASSISTANT = 'Assistant',
}

export type StudioConversationMessage = {
  author: StudioConversationMessageAuthor;
  message: string;
  error?: string;
};

export type DiffChunkType = {
  file: string;
  lang: string;
  repo: string;
  branch: string | null;
  hunks: DiffHunkType[];
  raw_patch: string;
};

export type DiffHunkType = {
  line_start: number;
  patch: string;
};

export enum StudioLeftPanelType {
  CONTEXT = 'context',
  TEMPLATES = 'templates',
  FILE = 'file',
  DIFF = 'diff',
  DOCS = 'docs',
}

export enum StudioRightPanelType {
  CONVERSATION = 'conversation',
}

export type FileStudioPanelType = {
  type: StudioLeftPanelType.FILE;
  data: {
    repo: RepoType;
    branch: string | null;
    filePath: string;
    isFileInContext: boolean;
    initialRanges?: [number, number][];
  };
};

export type DocsStudioPanelType = {
  type: StudioLeftPanelType.DOCS;
  data: {
    docProvider: DocShortType;
    url: string;
    absoluteUrl: string;
    title: string;
    selectedSection?: string;
    isDocInContext: boolean;
    initialSections?: string[];
  };
};

export type DiffPanelType = {
  type: StudioLeftPanelType.DIFF;
  data: {
    repo: RepoType;
    branch: string | null;
    filePath: string;
    hunks: DiffHunkType[];
  };
};

export type StudioLeftPanelDataType =
  | {
      type: StudioLeftPanelType.CONTEXT | StudioLeftPanelType.TEMPLATES;
      data?: null;
    }
  | FileStudioPanelType
  | DocsStudioPanelType
  | DiffPanelType;

export type StudioRightPanelDataType = {
  type: StudioRightPanelType.CONVERSATION;
  data?: null;
};

export type StudioContextFile = {
  path: string;
  ranges: { start: number; end: number }[];
  repo: string;
  branch: string | null;
  hidden: boolean;
};

export type StudioContextDoc = {
  doc_id: string;
  doc_source: string;
  doc_icon: string | null;
  doc_title: string | null;
  relative_url: string;
  absolute_url: string;
  ranges: string[];
  hidden: boolean;
};
