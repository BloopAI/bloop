import { createContext } from 'react';
import { NavigationItem, UITabType } from '../types/general';
import { RepoSource } from '../types';

type ContextType = {
  tabs: UITabType[];
  activeTab: string;
  handleAddTab: (
    repoRef: string,
    repoName: string,
    name: string,
    source: RepoSource,
    history?: NavigationItem[],
  ) => void;
  handleRemoveTab: (t: string) => void;
  setActiveTab: (t: string) => void;
  updateTabNavHistory: (
    t: string,
    history: (prev: NavigationItem[]) => NavigationItem[],
  ) => void;
};

export const TabsContext = createContext<ContextType>({
  tabs: [
    {
      key: 'initial',
      name: 'Home',
      repoName: '',
      source: RepoSource.LOCAL,
      navigationHistory: [],
    },
  ],
  activeTab: 'initial',
  handleAddTab: () => {},
  handleRemoveTab: () => {},
  setActiveTab: () => {},
  updateTabNavHistory: () => {},
});
