import { ConversationMessage } from '../types/general';

export const conversationsCache: Record<string, ConversationMessage[]> = {};

export const repositoriesSyncCache = {
  shouldNotifyWhenDone: false,
};
