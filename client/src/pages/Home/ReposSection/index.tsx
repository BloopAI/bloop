import React, { useContext, useEffect, useState } from 'react';
import RepoCard from '../../../components/RepoCard';
import Button from '../../../components/Button';
import { GitHubLogo } from '../../../icons';
import { getRepos } from '../../../services/api';
import { RepoProvider, RepoType, SyncStatus } from '../../../types/general';
import { UIContext } from '../../../context/uiContext';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import { DeviceContext } from '../../../context/deviceContext';

type Props = {
  filter: number;
  emptyRepos?: boolean; // only for storybook
};

const textsMap = [
  {
    header: 'All repositories',
    title: 'No repositories',
    description:
      'You can scan your machine for local repositories or connect a GitHub account to sync your code to bloop',
    buttons: (openSettings: () => void) => (
      <>
        <Button
          variant="primary"
          key="Connect GitHub all"
          onClick={openSettings}
        >
          <GitHubLogo /> Connect GitHub
        </Button>
        <div className="flex items-center">
          <span className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-600 mx-3">or</span>
          <span className="flex-1 h-px bg-gray-800" />
        </div>
        <Button variant="secondary" key="sync local" onClick={openSettings}>
          Sync Local repos
        </Button>
      </>
    ),
  },
  {
    header: 'Local repositories',
    title: 'No repositories',
    description:
      'You can scan your machine for local repositories to sync your code to bloop',
    buttons: (openSettings: () => void) => (
      <Button variant="secondary" key="sync local" onClick={openSettings}>
        Sync Local repos
      </Button>
    ),
  },
  {
    header: 'GitHub repositories',
    title: 'No repositories',
    description: 'Connect a GitHub account to sync your code to bloop',
    buttons: (openSettings: () => void) => (
      <Button variant="secondary" key="connect github" onClick={openSettings}>
        <GitHubLogo /> Connect GitHub
      </Button>
    ),
  },
];

const ReposSection = ({ filter, emptyRepos }: Props) => {
  const [reposToShow, setReposToShow] = useState<RepoType[]>([]);
  const { setSettingsSection, setSettingsOpen } = useContext(UIContext);
  const { isRepoManagementAllowed, isSelfServe } = useContext(DeviceContext);
  const { setRepositories, repositories } = useContext(RepositoriesContext);

  useEffect(() => {
    if (!emptyRepos) {
      getRepos().then((data) => {
        setRepositories(data.list || []);
      });
      const intervalId = setInterval(() => {
        getRepos().then((data) => {
          setRepositories(data.list || []);
        });
      }, 10000);
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [emptyRepos]);

  useEffect(() => {
    switch (filter) {
      case 0:
        setReposToShow(
          repositories.filter(
            (r) =>
              r.sync_status !== SyncStatus.Uninitialized &&
              r.sync_status !== SyncStatus.Removed,
          ),
        );
        break;
      case 1:
        setReposToShow(
          repositories.filter(
            (r) =>
              r.provider === RepoProvider.Local &&
              r.sync_status !== SyncStatus.Uninitialized &&
              r.sync_status !== SyncStatus.Removed,
          ),
        );
        break;
      case 2:
        setReposToShow(
          repositories.filter(
            (r) =>
              r.provider === RepoProvider.GitHub &&
              r.sync_status !== SyncStatus.Uninitialized &&
              r.sync_status !== SyncStatus.Removed,
          ),
        );
        break;
    }
  }, [filter, repositories]);

  return (
    <div className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content">
      <div className="flex items-center justify-between">
        <h4 className="">
          {isSelfServe ? 'All repositories' : textsMap[filter].header}
        </h4>
        {isRepoManagementAllowed && (reposToShow.length || isSelfServe) ? (
          <Button
            variant="secondary"
            onClick={() => {
              setSettingsSection(1);
              setSettingsOpen(true);
            }}
          >
            Manage repositories
          </Button>
        ) : null}
      </div>

      <div className="mt-10 grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5 w-full 2xl:justify-between relative items-start grid-rows-[min-content]">
        {reposToShow.map(({ ref, ...r }, i) => (
          <RepoCard
            name={r.name}
            sync_status={r.sync_status}
            last_update={r.last_index}
            lang={r.most_common_lang}
            key={ref + i}
            provider={r.provider}
          />
        ))}
        {!reposToShow.length && !isSelfServe && (
          <div className="absolute top-[10vh] left-1/2 transform -translate-x-1/2 text-center w-96">
            <h5 className="select-none cursor-default">
              {textsMap[filter].title}
            </h5>
            <p className="body-s text-gray-500 mt-3 mb-6">
              {textsMap[filter].description}
            </p>
            <div className="w-full flex flex-col gap-4">
              {textsMap[filter].buttons(() => {
                setSettingsSection(1);
                setSettingsOpen(true);
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReposSection;
