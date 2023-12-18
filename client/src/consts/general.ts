import { LocaleType, SyncStatus } from '../types/general';

export const themesMap = {
  system: 'System Preference',
  dark: 'Dark',
  light: 'Light',
  black: 'Black',
};

export const localesMap: Record<LocaleType, { name: string; icon: string }> = {
  en: { name: 'English', icon: '🇬🇧' },
  ja: { name: '日本', icon: '🇯🇵' },
  zhCN: { name: '简体中文', icon: '🇨🇳' },
  es: { name: 'Español', icon: '🇪🇸' },
  it: { name: 'Italiano', icon: '🇮🇹' },
};

export const repoStatusMap = {
  [SyncStatus.Error]: { text: 'Error', color: 'bg-red-500' },
  [SyncStatus.Removed]: { text: 'Removed', color: 'bg-red-500' },
  [SyncStatus.Uninitialized]: { text: 'Not synced', color: 'bg-bg-shade' },
  [SyncStatus.Queued]: { text: 'Queued...', color: 'bg-bg-shade' },
  [SyncStatus.Cancelled]: { text: 'Cancelled', color: 'bg-bg-shade' },
  [SyncStatus.Cancelling]: { text: 'Cancelling...', color: 'bg-yellow' },
  [SyncStatus.Indexing]: { text: 'Indexing', color: 'bg-yellow' },
  [SyncStatus.Syncing]: { text: 'Cloning', color: 'bg-yellow' },
  [SyncStatus.Done]: { text: 'Last updated ', color: 'bg-green-500' },
  [SyncStatus.RemoteRemoved]: { text: 'Remote removed ', color: 'bg-red-500' },
};
