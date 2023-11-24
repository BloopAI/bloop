import { createContext } from 'react';
import { NavigationItem, TabType, UITabType } from '../types/general';
import { RepoSource } from '../../types';

type ContextType = {
  tabs: UITabType[];
  handleAddRepoTab: (
    repoRef: string,
    repoName: string,
    name: string,
    source: RepoSource,
    branch?: string | null,
    history?: NavigationItem[],
  ) => void;
  handleAddStudioTab: (name: string, id: string) => void;
  handleRemoveTab: (t: string) => void;
  setActiveTab: (t: string) => void;
  updateTabNavHistory: (
    t: string,
    history: (prev: NavigationItem[]) => NavigationItem[],
  ) => void;
  updateTabBranch: (t: string, branch: string | null) => void;
  updateTabName: (t: string, name: string) => void;
  handleReorderTabs: (tabs: UITabType[]) => void;
};

export const TabsContext = createContext<ContextType>({
  tabs: [
    {
      key: 'initial',
      name: 'Home',
      type: TabType.HOME,
    },
  ],
  handleAddRepoTab: () => {},
  handleAddStudioTab: () => {},
  handleRemoveTab: () => {},
  setActiveTab: () => {},
  updateTabNavHistory: () => {},
  updateTabBranch: () => {},
  updateTabName: () => {},
  handleReorderTabs: () => {},
});
