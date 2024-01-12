import {
  memo,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Trans } from 'react-i18next/TransWithoutContext';
import { RepositoriesContext } from '../repositoriesContext';
import { IndexingStatusType, SyncStatus } from '../../types/general';
import { splitPath } from '../../utils';
import { RepositoryIcon } from '../../icons';
import { DeviceContext } from '../deviceContext';
import { ProjectContext } from '../projectContext';
import { getIndexedRepos } from '../../services/api';

type Props = {};

const RepositoriesContextProvider = ({
  children,
}: PropsWithChildren<Props>) => {
  const { t } = useTranslation();
  const { apiUrl } = useContext(DeviceContext);
  const { project, refreshCurrentProjectRepos } = useContext(
    ProjectContext.Current,
  );
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatusType>({});
  const eventSourceRef = useRef<EventSource | null>(null);

  const startEventSource = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = new EventSource(
      `${apiUrl.replace('https:', '')}/repos/status`,
    );
    eventSourceRef.current.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      console.log('data', data);
      if (data.ev?.status_change === SyncStatus.Done) {
        if (!data.rsync) {
          toast(t('Repository indexed'), {
            id: `${data.ref}-indexed`,
            description: (
              <Trans
                values={{
                  repoName: splitPath(data.ref)
                    .slice(data.ref.startsWith('github.com/') ? -2 : -1)
                    .join('/'),
                }}
              >
                <span className="text-label-base body-s-b">repoName</span> has
                finished indexing. You can use it in your projects now.
              </Trans>
            ),
            icon: <RepositoryIcon sizeClassName="w-4 h-4" />,
            unstyled: true,
          });
        }
        if (project?.repos.find((r) => r.repo.ref === data.ref)) {
          refreshCurrentProjectRepos();
        }
      }
      if (data.ev?.status_change) {
        setIndexingStatus((prev) => ({
          ...prev,
          [data.ref]: {
            ...(prev[data.ref] ? prev[data.ref] : {}),
            status: data.ev?.status_change,
          },
        }));
      }
      if (data.ev?.index_percent) {
        setIndexingStatus((prev) => ({
          ...prev,
          [data.ref]: {
            ...(prev[data.ref] ? prev[data.ref] : {}),
            percentage: data.ev?.index_percent,
            branch: data.b?.select[0],
          },
        }));
      }
    };
  }, [project?.repos]);

  useEffect(() => {
    startEventSource();
    const intervalId = window.setInterval(startEventSource, 10 * 60 * 1000);
    return () => {
      clearInterval(intervalId);
      eventSourceRef.current?.close();
    };
  }, [startEventSource]);

  useEffect(() => {
    getIndexedRepos().then((repos) => {
      const reposInProgress = repos.list.filter(
        (r) => r.sync_status !== SyncStatus.Done,
      );
      setIndexingStatus((prev) => {
        const newRepos = JSON.parse(JSON.stringify(prev));
        reposInProgress.forEach((r) => {
          newRepos[r.ref] = {
            ...(newRepos[r.ref] || {}),
            status: r.sync_status,
          };
        });
        return newRepos;
      });
    });
  }, []);

  const contextValue = useMemo(() => {
    return {
      indexingStatus,
      setIndexingStatus,
    };
  }, [indexingStatus]);

  return (
    <RepositoriesContext.Provider value={contextValue}>
      {children}
    </RepositoriesContext.Provider>
  );
};

export default memo(RepositoriesContextProvider);
