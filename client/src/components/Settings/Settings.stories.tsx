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
        tab={{ name: '', repoName: '', key: '', source: RepoSource.LOCAL }}
      >
        <RepositoriesContext.Provider
          value={{
            repositories: [],
            setRepositories: () => {},
            localSyncError: false,
            githubSyncError: false,
          }}
        >
          <Settings />
        </RepositoriesContext.Provider>
      </UIContextProvider>
    </div>
  );
};
