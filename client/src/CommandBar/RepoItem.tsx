import {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { CommandBarStepEnum, RepoUi, SyncStatus } from '../types/general';
import { cancelSync, syncRepo } from '../services/api';
import { RepositoryIcon } from '../icons';
import { DeviceContext } from '../context/deviceContext';
import LiteLoaderContainer from '../components/Loaders/LiteLoader';
import { getDateFnsLocale } from '../utils';
import { LocaleContext } from '../context/localeContext';
import Item from './Body/Item';

type Props = {
  repo: RepoUi;
  i: number;
  isFocused: boolean;
  setFocusedIndex: Dispatch<SetStateAction<number>>;
  isFirst: boolean;
};

const RepoItem = ({ repo, isFirst, setFocusedIndex, isFocused, i }: Props) => {
  const { t } = useTranslation();
  const { locale } = useContext(LocaleContext);
  const [status, setStatus] = useState(repo.sync_status);
  const [lastIndexed, setLastIndexed] = useState(repo.last_index);
  const [indexingStartedAt, setIndexingStartedAt] = useState(Date.now());
  const { apiUrl } = useContext(DeviceContext);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startEventSource = useCallback(() => {
    eventSourceRef.current = new EventSource(
      `${apiUrl.replace('https:', '')}/repos/status`,
    );
    eventSourceRef.current.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        console.log(data, repo.ref);
        if (data.ev?.status_change && data.ref === repo.ref) {
          setStatus(data.ev?.status_change);
          if (data.ev?.status_change === SyncStatus.Done) {
            setLastIndexed(new Date().toISOString());
            eventSourceRef.current?.close();
            eventSourceRef.current = null;
          }
        }
        // if (
        //   Number.isInteger(data.ev?.index_percent) ||
        //   data.ev?.index_percent === null
        // ) {
        //   setCurrentlySyncingRepos((prev) => ({
        //     ...prev,
        //     [data.ref]: data.ev.index_percent,
        //   }));
        // }
      } catch {
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
      }
    };
    eventSourceRef.current.onerror = () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      [SyncStatus.Indexing, SyncStatus.Syncing, SyncStatus.Queued].includes(
        status,
      ) &&
      !eventSourceRef.current
    ) {
      startEventSource();
    }
  }, [status]);

  const onRepoSync = useCallback(async () => {
    setIndexingStartedAt(Date.now());
    await syncRepo(repo.ref);
    startEventSource();
  }, [repo.ref]);

  const handleAddToProject = useCallback(() => {
    console.log(repo);
  }, [repo]);

  const handleCancelSync = useCallback(() => {
    cancelSync(repo.ref);
    setStatus(SyncStatus.Cancelled);
  }, [repo.ref]);

  const isIndexing = useMemo(() => {
    return [
      SyncStatus.Indexing,
      SyncStatus.Syncing,
      SyncStatus.Queued,
    ].includes(status);
  }, [status]);

  return (
    <Item
      key={repo.ref}
      setFocusedIndex={setFocusedIndex}
      isFocused={isFocused}
      i={i}
      isFirst={isFirst}
      Icon={isIndexing ? LiteLoaderContainer : RepositoryIcon}
      label={repo.shortName}
      id={CommandBarStepEnum.REPO_SETTINGS}
      footerHint={
        isIndexing
          ? t('Indexing started at') +
            ' ' +
            format(indexingStartedAt, 'MMM, dd yyyy', {
              ...(getDateFnsLocale(locale) || {}),
            })
          : status === SyncStatus.Done
          ? `Open ${repo.shortName}`
          : t('Index repository')
      }
      iconContainerClassName={
        status === SyncStatus.Done
          ? 'bg-bg-contrast text-label-contrast'
          : 'bg-bg-border'
      }
      onClick={onRepoSync}
      footerBtns={
        status === SyncStatus.Done
          ? [
              {
                label: t('Re-sync'),
                shortcut: ['cmd', 'R'],
                action: onRepoSync,
              },
              {
                label: t('Add to project'),
                shortcut: ['entr'],
                action: handleAddToProject,
              },
            ]
          : isIndexing
          ? [
              {
                label: t('Stop indexing'),
                shortcut: ['entr'],
                action: handleCancelSync,
              },
            ]
          : [
              {
                label: t('Start indexing'),
                shortcut: ['entr'],
                action: onRepoSync,
              },
            ]
      }
      customRightElement={
        isIndexing ? (
          <p className="body-mini text-label-link">{t('Indexing...')}</p>
        ) : status === SyncStatus.Done ? (
          <p className="body-mini text-label-base">
            {t('Last indexed')}{' '}
            {format(new Date(lastIndexed), 'MMM, dd yyyy', {
              ...(getDateFnsLocale(locale) || {}),
            })}
          </p>
        ) : undefined
      }
    />
  );
};

export default memo(RepoItem);
