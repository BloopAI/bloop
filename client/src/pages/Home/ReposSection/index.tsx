import React, {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from 'react';
import RepoCard from '../../../components/RepoCard';
import { RepoType, SyncStatus } from '../../../types/general';
import { DeviceContext } from '../../../context/deviceContext';
import RepoCardSkeleton from '../../../components/RepoCard/RepoCardSkeleton';
import NoRepos from '../../../components/RepoCard/NoRepos';
import { RepositoriesContext } from '../../../context/repositoriesContext';

type Props = {
  reposToShow: RepoType[];
  setReposToShow: Dispatch<SetStateAction<RepoType[]>>;
  repositories?: RepoType[];
};

let eventSource: EventSource;

const ReposSection = ({ reposToShow, setReposToShow, repositories }: Props) => {
  const { apiUrl } = useContext(DeviceContext);
  const { setRepositories } = useContext(RepositoriesContext);
  const [currentlySyncingRepo, setCurrentlySyncingRepo] = useState<{
    repoRef: string;
    percentage: number;
  } | null>(null);

  useEffect(() => {
    eventSource?.close();
    eventSource = new EventSource(
      `${apiUrl.replace('https:', '')}/repos/status`,
    );
    eventSource.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.ev?.status_change) {
          setRepositories((prev: RepoType[] | undefined) => {
            if (!prev) {
              return prev;
            }
            const index = prev.findIndex((r) => r.ref === data.ref);
            const newRepos = [...prev];
            newRepos[index] = {
              ...newRepos[index],
              sync_status: data.ev?.status_change,
              last_index:
                data.ev?.status_change === SyncStatus.Done
                  ? new Date().toISOString()
                  : '',
            };
            return newRepos;
          });
        }
        if (data.ev?.index_percent) {
          setCurrentlySyncingRepo({
            repoRef: data.ref,
            percentage: data.ev?.index_percent || 1,
          });
        }
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

  return (
    <div className="p-8 flex-1 overflow-x-auto relative">
      <h4 className="mb-3">All repositories</h4>
      <div className="flex flex-wrap gap-3.5 w-full relative items-start">
        {reposToShow.map(({ ref, ...r }, i) => (
          <RepoCard
            name={r.name}
            repoRef={ref}
            sync_status={r.sync_status}
            last_index={r.last_index}
            lang={r.most_common_lang}
            key={ref + i}
            provider={r.provider}
            syncStatus={
              currentlySyncingRepo?.repoRef === ref
                ? currentlySyncingRepo
                : null
            }
            onDelete={() => {
              setReposToShow((prev) => prev.filter((r) => r.ref !== ref));
            }}
            indexedBranches={r.branch_filter?.select}
          />
        ))}
      </div>
      {!repositories ? (
        <div className="flex flex-wrap gap-3.5 w-full relative items-start">
          {new Array(6).fill('x').map((_, i) => (
            <RepoCardSkeleton key={i} />
          ))}
        </div>
      ) : !reposToShow.length ? (
        <div className="flex w-full flex-col items-center justify-center gap-4 px-4 py-11 bg-bg-sub border border-bg-border rounded-md">
          <NoRepos />
          <div className="flex flex-col gap-3 items-center">
            <p className="subhead-m text-label-title">No repositories</p>
            <p className="body-s text-label-muted">
              As soon as you add a repository it will appear here.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ReposSection;
