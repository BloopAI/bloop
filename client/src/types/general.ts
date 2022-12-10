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
};

export enum SyncStatus {
  Uninitialized = 'uninitialized',
  Queued = 'queued',
  Done = 'done',
  Error = 'error',
  Removed = 'removed',
  Indexing = 'indexing',
  Syncing = 'syncing',
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
