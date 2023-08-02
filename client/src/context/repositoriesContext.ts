import { createContext, Dispatch, SetStateAction } from 'react';
import { RepoType } from '../types/general';

type ContextType = {
  repositories?: RepoType[];
  setRepositories: Dispatch<SetStateAction<RepoType[] | undefined>>;
  fetchRepos: () => void;
};

export const RepositoriesContext = createContext<ContextType>({
  repositories: [],
  setRepositories: () => {},
  fetchRepos: () => {},
});
