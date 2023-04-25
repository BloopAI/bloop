import React, { useContext, useEffect, useState } from 'react';
import RepoCard from '../../../components/RepoCard';
import { getRepos } from '../../../services/api';
import { RepoType, SyncStatus } from '../../../types/general';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import { DeviceContext } from '../../../context/deviceContext';
import { repositoriesSyncCache } from '../../../services/cache';

const filterRepositories = (repos?: RepoType[]) => {
  return (
    repos?.filter(
      (r) =>
        r.sync_status !== SyncStatus.Uninitialized &&
        r.sync_status !== SyncStatus.Removed,
    ) || []
  );
};

let eventSource: EventSource;

const ReposSection = () => {
  const { apiUrl, showNativeMessage } = useContext(DeviceContext);
  const { setRepositories, repositories } = useContext(RepositoriesContext);
  const [reposToShow, setReposToShow] = useState<RepoType[]>(
    filterRepositories(repositories),
  );
  const [currentlySyncingRepo, setCurrentlySyncingRepo] = useState<{
    repoRef: string;
    indexStep: number;
    percentage: number;
  } | null>(null);

  useEffect(() => {
    const fetchRepos = () => {
      getRepos().then((data) => {
        const list =
          data?.list?.sort((a, b) => (a.name < b.name ? -1 : 1)) || [];
        setRepositories(list);
        setReposToShow(filterRepositories(list));
      });
    };
    fetchRepos();
    const intervalId = setInterval(fetchRepos, 10000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    eventSource?.close();
    eventSource = new EventSource(
      `${apiUrl.replace('https:', '')}/repos/index-status`,
    );
    eventSource.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        setCurrentlySyncingRepo({
          repoRef: data[0],
          indexStep: data[1],
          percentage: data[2],
        });
      } catch {}
    };
    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      setCurrentlySyncingRepo(null);
    };
    return () => {
      eventSource?.close();
    };
  }, []);

  useEffect(() => {
    if (repositoriesSyncCache.shouldNotifyWhenDone) {
      if (
        repositories?.find((r) => r.sync_status === SyncStatus.Done) &&
        repositories?.every(
          (r) =>
            r.sync_status === SyncStatus.Done ||
            r.sync_status === SyncStatus.Uninitialized,
        )
      ) {
        showNativeMessage(
          'All repositories are now indexed and ready for search!',
          { title: 'Ready to search!' },
        );
        repositoriesSyncCache.shouldNotifyWhenDone = false;
      }
    }
  }, [repositories]);

  return (
    <div className="p-8 flex-1 overflow-x-auto relative">
      <h4 className="mb-3">All repositories</h4>
      <div className="flex flex-wrap gap-3.5 w-full relative items-start">
        {reposToShow.map(({ ref, ...r }, i) => (
          <RepoCard
            name={r.name}
            repoRef={ref}
            sync_status={r.sync_status}
            last_update={r.last_index}
            lang={r.most_common_lang}
            key={ref + i}
            provider={r.provider}
            isSyncing={
              currentlySyncingRepo?.repoRef === ref &&
              (currentlySyncingRepo?.indexStep !== 1 ||
                currentlySyncingRepo?.percentage !== 100)
            }
            syncStatus={currentlySyncingRepo}
          />
        ))}
      </div>
      {!reposToShow.length ? (
        <div className="flex w-full flex-col items-center justify-center gap-4 px-4 py-11 bg-gray-900 border border-gray-800 rounded-md">
          <img src="/no-repos.png" className="w-64" alt="No repositories" />
          <div className="flex flex-col gap-3 items-center">
            <p className="subhead-m text-white">No repositories</p>
            <p className="body-s text-gray-400">
              As soon as you add a repository it will appear here.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ReposSection;
