import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import { MenuItemType, RepoProvider, SyncStatus } from '../../../types/general';
import { PlusSignInBubble, Repository } from '../../../icons';
import { deleteRepo, getRepos, gitHubLogout } from '../../../services/api';
import { UIContext } from '../../../context/uiContext';
import RepoList from '../../RepoList';
import { getCommonFolder, splitPath } from '../../../utils';
import { DropdownWithIcon } from '../../Dropdown';
import GitHubIcon from '../../../icons/GitHubIcon';
import { DeviceContext } from '../../../context/deviceContext';
import AddRepos from './AddRepos';
import GithubStatus from './GithubStatus';

const dropdownIcon = (
  <>
    <PlusSignInBubble />
    Add repositories
  </>
);

const RepositoriesSettings = () => {
  const { repositories, setRepositories } = useContext(RepositoriesContext);
  const {
    onBoardingState,
    isGithubConnected,
    setGithubConnected,
    setSettingsOpen,
  } = useContext(UIContext);
  const { isSelfServe } = useContext(DeviceContext);
  const [isAddReposOpen, setAddReposOpen] = useState<null | 'local' | 'github'>(
    null,
  );

  const localRepos = useMemo(() => {
    const localRepositories =
      repositories?.filter(
        (r) =>
          r.provider === RepoProvider.Local && r.sync_status == SyncStatus.Done,
      ) || [];
    const commonFolder =
      localRepositories.length > 1
        ? getCommonFolder(localRepositories.map((lr) => lr.ref))
        : '';
    return localRepositories
      .map((r) => {
        const folderName =
          localRepositories.length > 1
            ? r.ref.replace(commonFolder, '')
            : `/${r.ref
                .slice(
                  r.ref.indexOf(
                    splitPath(onBoardingState.indexFolder).pop() || '',
                  ),
                )
                .slice(0, -r.name.length - 1)}`;
        return {
          ...r,
          selected: true,
          shortName: r.name,
          folderName,
        };
      })
      .sort((a, b) => (a.folderName > b.folderName ? 1 : -1));
  }, [repositories]);

  const githubRepos = useMemo(() => {
    return (
      repositories
        ?.filter(
          (r) =>
            r.provider === RepoProvider.GitHub &&
            (r.sync_status == SyncStatus.Done ||
              r.sync_status == SyncStatus.RemoteRemoved),
        )
        .map((r) => {
          const pathParts = splitPath(r.name);
          return {
            ...r,
            selected: true,
            shortName: pathParts[pathParts.length - 1],
            folderName: pathParts[0],
          };
        })
        .sort((a, b) => (a.folderName > b.folderName ? 1 : -1)) || []
    );
  }, [repositories]);

  const [githubAuth, setGitHubAuth] = useState(!githubRepos.length);
  useEffect(() => {
    setGitHubAuth(!githubRepos.length);
  }, [githubRepos.length]);

  useEffect(() => {
    getRepos().then((data) => {
      setRepositories(data.list || []);
    });
  }, []);

  const handleRemoveOne = useCallback(async (repoRef: string) => {
    await deleteRepo(repoRef);
  }, []);

  const addReposMenuItems = useMemo(
    () => [
      ...(!isSelfServe
        ? [
            {
              text: 'Local repo',
              icon: <Repository />,
              type: MenuItemType.DEFAULT,
              onClick: () => {
                setAddReposOpen('local');
              },
            },
          ]
        : []),
      ...(isGithubConnected
        ? [
            {
              text: 'GitHub repo',
              icon: <GitHubIcon />,
              type: MenuItemType.DEFAULT,
              onClick: () => {
                setAddReposOpen('github');
              },
            },
          ]
        : []),
    ],
    [isGithubConnected],
  );

  const onLogout = useCallback(() => {
    gitHubLogout().then(() => {
      setGithubConnected(false);
    });
  }, []);

  return (
    <>
      <div className="w-full relative overflow-auto flex flex-col h-full">
        <div className="mb-6 flex items-center justify-between">
          <h5>Repositories</h5>
          <DropdownWithIcon
            items={addReposMenuItems}
            noChevron
            btnVariant="secondary"
            icon={dropdownIcon}
          />
        </div>
        <div className="flex flex-col gap-3.5">
          {!isSelfServe && (
            <GithubStatus
              setGitHubAuth={setGitHubAuth}
              setGitHubConnected={setGithubConnected}
              githubAuth={githubAuth}
              isConnected={isGithubConnected}
              onLogout={onLogout}
            />
          )}
        </div>
        <div className="mt-6 overflow-auto">
          <p className="text-gray-500 caption">Added repositories</p>
          {!!localRepos.length && (
            <RepoList
              repos={localRepos}
              setRepos={() => {}}
              source="local"
              activeTab={0}
              removable
              handleRemoveOne={handleRemoveOne}
            />
          )}
          {!!githubRepos.length && (
            <RepoList
              repos={githubRepos}
              setRepos={() => {}}
              source="GitHub"
              activeTab={0}
              removable
              handleRemoveOne={handleRemoveOne}
            />
          )}
        </div>
      </div>
      <AddRepos
        addRepos={isAddReposOpen}
        onClose={(isSubmitted) => {
          setAddReposOpen(null);
          if (isSubmitted) {
            setSettingsOpen(false);
          }
        }}
      />
    </>
  );
};

export default RepositoriesSettings;
