import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import { MenuItemType, RepoProvider, SyncStatus } from '../../../types/general';
import { useGitHubAuth } from '../../../hooks/useGitHubAuth';
import { DeviceContext } from '../../../context/deviceContext';
import {
  Clipboard,
  GitHubLogo,
  PlusSignInBubble,
  Repository,
} from '../../../icons';
import Button from '../../Button';
import { getRepos, gitHubStatus, syncRepos } from '../../../services/api';
import { UIContext } from '../../../context/uiContext';
import RepoList from '../../RepoList';
import { getCommonFolder, splitPath } from '../../../utils';
import { DropdownWithIcon } from '../../Dropdown';
import GitHubIcon from '../../../icons/GitHubIcon';
import AddRepos from './AddRepos';

const RepositoriesSettings = () => {
  const { repositories, setRepositories } = useContext(RepositoriesContext);
  const { openLink } = useContext(DeviceContext);
  const { settingsSection, isSettingsOpen, onBoardingState } =
    useContext(UIContext);
  const [isAddReposOpen, setAddReposOpen] = useState<null | 'local' | 'github'>(
    null,
  );

  const localRepos = useMemo(() => {
    const localRepositories = repositories.filter(
      (r) =>
        r.provider === RepoProvider.Local && r.sync_status == SyncStatus.Done,
    );
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
    return repositories
      .filter(
        (r) =>
          r.provider === RepoProvider.GitHub &&
          r.sync_status == SyncStatus.Done,
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
      .sort((a, b) => (a.folderName > b.folderName ? 1 : -1));
  }, [repositories]);

  const [githubAuth, setGitHubAuth] = useState(!githubRepos.length);
  useEffect(() => {
    setGitHubAuth(!githubRepos.length);
  }, [githubRepos.length]);

  const { code, loginUrl, handleClick, handleCopy, codeCopied, buttonClicked } =
    useGitHubAuth(() => {
      setGitHubAuth(false);
      setGitHubConnected(true);
    }, !githubAuth || !isSettingsOpen || settingsSection !== 1);

  const [isGithubConnected, setGitHubConnected] = useState(false);

  useEffect(() => {
    gitHubStatus().then((r) => {
      setGitHubConnected(r.status === 'ok');
    });
    getRepos().then((data) => {
      setRepositories(data.list || []);
    });
  }, []);

  const handleRemoveOne = useCallback(
    (repoRef: string) => {
      syncRepos(
        [...localRepos, ...githubRepos]
          .filter((r) => r.ref !== repoRef)
          .map((r) => r.ref),
      ).then(console.log);
    },
    [localRepos, githubRepos],
  );

  return (
    <>
      <div className="w-full relative overflow-auto flex flex-col h-full">
        <div className="mb-6 flex items-center justify-between">
          <h5>Repositories</h5>
          <DropdownWithIcon
            items={[
              {
                text: 'Local repo',
                icon: <Repository />,
                type: MenuItemType.DEFAULT,
                onClick: () => {
                  setAddReposOpen('local');
                },
              },
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
            ]}
            noChevron
            btnVariant="secondary"
            icon={
              <>
                <PlusSignInBubble />
                Add repositories
              </>
            }
          />
        </div>
        <div className="flex flex-col gap-3.5">
          {!isGithubConnected && (
            <div className="border border-gray-800 shadow-light rounded-4 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-3 callout items-center">
                  <GitHubLogo />
                  Connect a GitHub account to sync your code to bloop
                </div>
                <div className="flex gap-2 flex-shrink-0 items-center">
                  {githubAuth ? (
                    code ? (
                      <span className="tracking-[0.15em] flex-shrink-0 flex items-center">
                        {code}
                        <Button
                          onlyIcon
                          variant="tertiary"
                          size="small"
                          onClick={handleCopy}
                          title={
                            codeCopied
                              ? 'Copied to clipboard'
                              : 'Copy to clipboard'
                          }
                        >
                          <Clipboard />
                        </Button>
                      </span>
                    ) : (
                      <span>Loading...</span>
                    )
                  ) : null}
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      handleClick();
                      openLink(loginUrl);
                    }}
                    disabled={buttonClicked}
                  >
                    {buttonClicked ? 'Waiting for auth' : 'Connect'}
                  </Button>
                </div>
              </div>
            </div>
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
        onClose={() => setAddReposOpen(null)}
      />
    </>
  );
};

export default RepositoriesSettings;
