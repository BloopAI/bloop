import { createContext } from 'react';
import { RepoType } from '../types/general';

type ContextType = {
  repositories?: RepoType[];
  setRepositories: (r: RepoType[]) => void;
  localSyncError: boolean;
  githubSyncError: boolean;
  fetchRepos: () => void;
};

export const RepositoriesContext = createContext<ContextType>({
  repositories: [],
  setRepositories: () => {},
  fetchRepos: () => {},
  localSyncError: false,
  githubSyncError: false,
});
