import { createContext } from 'react';
import { RepoType } from '../types/general';

type ContextType = {
  repositories?: RepoType[];
  setRepositories: (r: RepoType[]) => void;
  localSyncError: boolean;
  githubSyncError: boolean;
};

export const RepositoriesContext = createContext<ContextType>({
  repositories: [],
  setRepositories: () => {},
  localSyncError: false,
  githubSyncError: false,
});
