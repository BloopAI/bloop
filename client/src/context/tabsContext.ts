import { createContext } from 'react';
import { NavigationItem, UITabType } from '../types/general';
import { RepoSource } from '../types';

type ContextType = {
  tabs: UITabType[];
  handleAddTab: (
    repoRef: string,
    repoName: string,
    name: string,
    source: RepoSource,
    branch?: string | null,
    history?: NavigationItem[],
  ) => void;
  handleRemoveTab: (t: string) => void;
  updateTabNavHistory: (
    t: string,
    history: (prev: NavigationItem[]) => NavigationItem[],
  ) => void;
  updateTabBranch: (t: string, branch: string | null) => void;
};

export const TabsContext = createContext<ContextType>({
  tabs: [
    {
      key: 'initial',
      name: 'Home',
      repoName: '',
      source: RepoSource.LOCAL,
      navigationHistory: [],
      currentUrl: '/',
    },
  ],
  handleAddTab: () => {},
  handleRemoveTab: () => {},
  updateTabNavHistory: () => {},
  updateTabBranch: () => {},
});
