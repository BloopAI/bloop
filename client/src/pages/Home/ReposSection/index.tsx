import React, {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from 'react';
import RepoCard from '../../../components/RepoCard';
import { RepoType } from '../../../types/general';
import { DeviceContext } from '../../../context/deviceContext';
import { UIContext } from '../../../context/uiContext';

type Props = {
  reposToShow: RepoType[];
  setReposToShow: Dispatch<SetStateAction<RepoType[]>>;
};

let eventSource: EventSource;

const ReposSection = ({ reposToShow, setReposToShow }: Props) => {
  const { apiUrl } = useContext(DeviceContext);
  const [currentlySyncingRepo, setCurrentlySyncingRepo] = useState<{
    repoRef: string;
    indexStep: number;
    percentage: number;
  } | null>(null);

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
            onDelete={() => {
              setReposToShow((prev) => prev.filter((r) => r.ref !== ref));
            }}
          />
        ))}
      </div>
      {!reposToShow.length ? (
        <div className="flex w-full flex-col items-center justify-center gap-4 px-4 py-11 bg-bg-sub border border-bg-border rounded-md">
          <img className="w-64 img-no-repos" alt="No repositories" />
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
