import { createContext, Dispatch, SetStateAction } from 'react';
import { RepoType } from '../types/general';

type ContextType = {
  repositories?: RepoType[];
  setRepositories: Dispatch<SetStateAction<RepoType[] | undefined>>;
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
