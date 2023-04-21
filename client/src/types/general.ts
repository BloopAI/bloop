import React, { ReactElement } from 'react';

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
};

export type RepoUi = RepoType & {
  selected: boolean;
  shortName: string;
  folderName: string;
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

export type UITabType = {
  key: string;
  searchHistory?: string[];
  name: string;
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

type ChatMessageUser = {
  author: ChatMessageAuthor.User;
  text: string;
};

export type MessageResultCite = {
  Cite: {
    path_alias: number;
    path: string;
    comment: string;
    start_line: number;
    end_line: number;
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

export type ChatMessageServer = {
  author: ChatMessageAuthor.Server;
  text?: string;
  isLoading: boolean;
  loadingSteps: string[];
  error?: string;
  type: ChatMessageType;
  results?: (MessageResultCite | MessageResultNew | MessageResultModify)[];
};

export type ChatMessage = ChatMessageUser | ChatMessageServer;

export interface NavigationItem {
  type: 'search' | 'repo' | 'full-result' | 'home' | 'conversation-result';
  query?: string;
  repo?: string;
  path?: string;
  page?: number;
  loaded?: boolean;
  searchType?: SearchType;
  pathParams?: Record<string, string>;
  threadId?: string;
  recordId?: number;
}
