import { TabType } from '../types/general';

export const conversationsCache: Record<string, any> = {};

export const repositoriesSyncCache = {
  shouldNotifyWhenDone: false,
};

export const openTabsCache: { tabs: TabType[] } = {
  tabs: [],
};
