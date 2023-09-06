import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans } from 'react-i18next';
import { RepoType, SyncStatus } from '../../../types/general';
import { DeviceContext } from '../../../context/deviceContext';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import RepoCard from './RepoCard';
import RepoCardSkeleton from './RepoCard/RepoCardSkeleton';
import NoRepos from './RepoCard/NoRepos';

type Props = {
  reposToShow: RepoType[];
  setReposToShow: Dispatch<SetStateAction<RepoType[]>>;
  repositories?: RepoType[];
  shouldShowFull?: boolean;
  isFiltered?: boolean;
  showAll: () => void;
};

let eventSource: EventSource;

const LIMIT = 7;

const ReposSection = ({
  reposToShow,
  setReposToShow,
  repositories,
  shouldShowFull,
  isFiltered,
  showAll,
}: Props) => {
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
        if (Number.isInteger(data.ev?.index_percent)) {
          setCurrentlySyncingRepo({
            repoRef: data.ref,
            percentage: data.ev.index_percent,
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

  const onDelete = useCallback((ref: string) => {
    setReposToShow((prev) => prev.filter((r) => r.ref !== ref));
  }, []);

  return (
    <div className="px-8 pt-8 relative">
      {!reposToShow.length && isFiltered ? null : (
        <h4 className="mb-3">
          <Trans>All repositories</Trans>
        </h4>
      )}
      <div className="flex flex-wrap gap-3.5 w-full relative items-start">
        {(shouldShowFull ? reposToShow : reposToShow.slice(0, LIMIT)).map(
          ({ ref, ...r }, i) => (
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
              onDelete={onDelete}
              indexedBranches={r.branch_filter?.select}
            />
          ),
        )}
        {reposToShow.length > LIMIT && !shouldShowFull && (
          <button
            onClick={showAll}
            className="border border-bg-border rounded-md hover:border-bg-border-hover focus:border-bg-border-hover
            p-4 w-67 h-36 group flex-shrink-0 flex flex-col justify-between cursor-pointer transition-all duration-150 select-none"
          >
            <p className="body-s text-label-link">
              <Trans>View all</Trans>
            </p>
            <p className="caption-strong text-label-base">
              <Trans count={reposToShow.length - LIMIT}>+ # more</Trans>
            </p>
          </button>
        )}
      </div>
      {!repositories ? (
        <div className="flex flex-wrap gap-3.5 w-full relative items-start">
          {new Array(6).fill('x').map((_, i) => (
            <RepoCardSkeleton key={i} />
          ))}
        </div>
      ) : !reposToShow.length ? (
        isFiltered ? null : (
          <div className="flex w-full flex-col items-center justify-center gap-4 px-4 py-11 bg-bg-sub border border-bg-border rounded-md">
            <NoRepos />
            <div className="flex flex-col gap-3 items-center">
              <p className="subhead-m text-label-title">
                <Trans>No repositories</Trans>
              </p>
              <p className="body-s text-label-muted">
                <Trans>
                  As soon as you add a repository it will appear here.
                </Trans>
              </p>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
};

export default memo(ReposSection);
