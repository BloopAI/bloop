import { createContext, Dispatch, SetStateAction } from 'react';
import { RepoType } from '../types/general';

type ContextType = {
  repositories?: RepoType[];
  setRepositories: Dispatch<SetStateAction<RepoType[] | undefined>>;
  localSyncError: boolean;
  githubSyncError: boolean;
};

export const RepositoriesContext = createContext<ContextType>({
  repositories: [],
  setRepositories: () => {},
  localSyncError: false,
  githubSyncError: false,
});
