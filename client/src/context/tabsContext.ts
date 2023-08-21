import { createContext } from 'react';
import { NavigationItem, TabType, UITabType } from '../types/general';
import { RepoSource } from '../types';

type ContextType = {
  tabs: UITabType[];
  activeTab: string;
  handleAddRepoTab: (
    repoRef: string,
    repoName: string,
    name: string,
    source: RepoSource,
    branch?: string | null,
    history?: NavigationItem[],
  ) => void;
  handleAddStudioTab: () => void;
  handleRemoveTab: (t: string) => void;
  setActiveTab: (t: string) => void;
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
      type: TabType.HOME,
    },
  ],
  activeTab: 'initial',
  handleAddRepoTab: () => {},
  handleAddStudioTab: () => {},
  handleRemoveTab: () => {},
  setActiveTab: () => {},
  updateTabNavHistory: () => {},
  updateTabBranch: () => {},
});
