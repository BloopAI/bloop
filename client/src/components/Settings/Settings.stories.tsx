import { RepositoriesContext } from '../../context/repositoriesContext';
import { UIContextProvider } from '../../context/providers/UiContextProvider';
import { RepoSource } from '../../types';
import Settings from './index';

export default {
  title: 'components/Settings',
  component: Settings,
};

export const Default = () => {
  return (
    <div className="">
      <UIContextProvider
        tab={{
          name: '',
          key: '',
          repoName: '',
          source: RepoSource.LOCAL,
          navigationHistory: [],
          currentUrl: '',
        }}
      >
        <RepositoriesContext.Provider
          value={{
            repositories: [],
            setRepositories: () => {},
            fetchRepos: () => {},
          }}
        >
          <Settings />
        </RepositoriesContext.Provider>
      </UIContextProvider>
    </div>
  );
};
