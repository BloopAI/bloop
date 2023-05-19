import { createContext } from 'react';
import { UITabType } from '../types/general';
import { RepoSource } from '../types';

type ContextType = {
  tabs: UITabType[];
  activeTab: string;
  handleAddTab: (
    repoRef: string,
    repoName: string,
    name: string,
    source: RepoSource,
  ) => void;
  handleRemoveTab: (t: string) => void;
  setActiveTab: (t: string) => void;
};

export const TabsContext = createContext<ContextType>({
  tabs: [
    { key: 'initial', name: 'Home', repoName: '', source: RepoSource.LOCAL },
  ],
  activeTab: 'initial',
  handleAddTab: () => {},
  handleRemoveTab: () => {},
  setActiveTab: () => {},
});
