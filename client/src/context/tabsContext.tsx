import { createContext } from 'react';
import { FileTabType } from '../types/general';

export const TabsContext = {
  Handlers: createContext({
    openNewTab: (path: string, repoName: string) => {},
    closeTab: (key: string) => {},
  }),
  All: createContext<{ tabs: FileTabType[] }>({
    tabs: [],
  }),
  Current: createContext<{ tab: FileTabType | null }>({
    tab: null,
  }),
};
