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
import {
  CommandBarStepEnum,
  RepoProvider,
  RepoUi,
  SyncStatus,
} from '../../../types/general';
import {
  addRepoToProject,
  cancelSync,
  deleteRepo,
  removeRepoFromProject,
  syncRepo,
} from '../../../services/api';
import {
  CloseSignInCircleIcon,
  LinkChainIcon,
  PlusSignIcon,
  RepositoryIcon,
  TrashCanIcon,
} from '../../../icons';
import { DeviceContext } from '../../../context/deviceContext';
import { getDateFnsLocale, getFileManagerName } from '../../../utils';
import { LocaleContext } from '../../../context/localeContext';
import Item from '../../Body/Item';
import SpinLoaderContainer from '../../../components/Loaders/SpinnerLoader';
import { ProjectContext } from '../../../context/projectContext';

type Props = {
  repo: RepoUi;
  i: number;
  isFocused: boolean;
  setFocusedIndex: Dispatch<SetStateAction<number>>;
  isFirst: boolean;
  refetchRepos: () => void;
  disableKeyNav?: boolean;
};

const RepoItem = ({
  repo,
  isFirst,
  setFocusedIndex,
  isFocused,
  i,
  refetchRepos,
  disableKeyNav,
}: Props) => {
  const { t } = useTranslation();
  const { locale } = useContext(LocaleContext);
  const { project, refreshCurrentProjectRepos } = useContext(
    ProjectContext.Current,
  );
  const [status, setStatus] = useState(repo.sync_status);
  const [indexingStartedAt, setIndexingStartedAt] = useState(Date.now());
  const { apiUrl, openFolderInExplorer, os, openLink } =
    useContext(DeviceContext);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setStatus(repo.sync_status);
  }, [repo.sync_status, repo.last_index]);

  const startEventSource = useCallback(() => {
    eventSourceRef.current = new EventSource(
      `${apiUrl.replace('https:', '')}/repos/status`,
    );
    eventSourceRef.current.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.ev?.status_change && data.ref === repo.ref) {
          setStatus(data.ev?.status_change);
          if (data.ev?.status_change === SyncStatus.Done) {
            eventSourceRef.current?.close();
            eventSourceRef.current = null;
            refetchRepos();
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
    setStatus(SyncStatus.Queued);
    startEventSource();
  }, [repo.ref]);

  const handleAddToProject = useCallback(async () => {
    if (project?.id) {
      await addRepoToProject(project.id, repo.ref);
      refreshCurrentProjectRepos();
    }
  }, [repo]);

  const handleOpenInFinder = useCallback(() => {
    openFolderInExplorer(repo.ref.slice(6));
  }, [openFolderInExplorer, repo.ref]);

  const handleOpenInGitHub = useCallback(() => {
    openLink('https://' + repo.ref);
  }, [openLink, repo.ref]);

  const handleRemoveFromProject = useCallback(async () => {
    if (project?.id) {
      await removeRepoFromProject(project.id, repo.ref);
      refreshCurrentProjectRepos();
    }
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

  const onRepoRemove = useCallback(async () => {
    await deleteRepo(repo.ref);
    refetchRepos();
  }, [repo.ref]);

  const isInProject = useMemo(() => {
    return project?.repos.find((r) => r.ref === repo.ref);
  }, [project, repo.ref]);

  const focusedItemProps = useMemo(() => {
    const dropdownItems1 = [];
    if (isIndexing) {
      dropdownItems1.push({
        onClick: handleCancelSync,
        label: t('Stop indexing'),
        icon: (
          <span className="w-6 h-6 flex items-center justify-center rounded-6 bg-bg-border">
            <CloseSignInCircleIcon sizeClassName="w-3.5 h-3.5" />
          </span>
        ),
        key: 'stop_indexing',
      });
    }
    if (repo.sync_status === SyncStatus.Done) {
      dropdownItems1.push(
        isInProject
          ? {
              onClick: handleRemoveFromProject,
              label: t('Remove from project'),
              icon: (
                <span className="w-6 h-6 flex items-center justify-center rounded-6 bg-bg-border">
                  <TrashCanIcon sizeClassName="w-3.5 h-3.5" />
                </span>
              ),
              key: 'remove_from_project',
            }
          : {
              onClick: handleAddToProject,
              label: t('Add to project'),
              icon: (
                <span className="w-6 h-6 flex items-center justify-center rounded-6 bg-bg-border">
                  <PlusSignIcon sizeClassName="w-3.5 h-3.5" />
                </span>
              ),
              key: 'add_to_project',
            },
      );
      dropdownItems1.push({
        onClick: onRepoSync,
        label: t('Re-sync'),
        shortcut: ['cmd', 'R'],
        key: 'resync',
      });
      dropdownItems1.push({
        onClick: onRepoRemove,
        label: t('Remove'),
        shortcut: ['cmd', 'D'],
        key: 'remove',
      });
    }
    const dropdownItems2 = [
      repo.provider === RepoProvider.Local
        ? {
            onClick: handleOpenInFinder,
            label: t(`Open in {{viewer}}`, {
              viewer: getFileManagerName(os.type),
            }),
            key: 'openInFinder',
          }
        : {
            onClick: handleOpenInGitHub,
            label: t(`Open in GitHub`),
            icon: (
              <span className="w-6 h-6 flex items-center justify-center rounded-6 bg-bg-border">
                <LinkChainIcon sizeClassName="w-3.5 h-3.5" />
              </span>
            ),
            key: 'openInGitHub',
          },
    ];
    const dropdownItems = [];
    if (dropdownItems1.length) {
      dropdownItems.push({ items: dropdownItems1, key: '1', itemsOffset: 0 });
    }
    if (dropdownItems2.length) {
      dropdownItems.push({
        items: dropdownItems2,
        key: '2',
        itemsOffset: dropdownItems1.length,
      });
    }
    return {
      dropdownItems,
    };
  }, [
    t,
    isInProject,
    handleAddToProject,
    handleRemoveFromProject,
    handleCancelSync,
    repo.sync_status,
    repo.provider,
    isIndexing,
    handleOpenInFinder,
    handleOpenInGitHub,
    onRepoRemove,
  ]);

  return (
    <Item
      key={repo.ref}
      setFocusedIndex={setFocusedIndex}
      isFocused={isFocused}
      i={i}
      isFirst={isFirst}
      Icon={isIndexing ? SpinLoaderContainer : RepositoryIcon}
      label={repo.shortName}
      id={CommandBarStepEnum.REPO_SETTINGS}
      footerHint={
        isIndexing
          ? t('Indexing...')
          : status === SyncStatus.Done
          ? ``
          : t('Index repository')
      }
      iconContainerClassName={
        isInProject
          ? 'bg-blue-subtle text-blue'
          : status === SyncStatus.Done
          ? 'bg-bg-contrast text-label-contrast'
          : 'bg-bg-border'
      }
      onClick={
        status === SyncStatus.Done
          ? isInProject
            ? handleRemoveFromProject
            : handleAddToProject
          : isIndexing
          ? handleCancelSync
          : onRepoSync
      }
      footerBtns={
        status === SyncStatus.Done
          ? [
              {
                label: isInProject
                  ? t('Remove from project')
                  : t('Add to project'),
                shortcut: ['entr'],
                action: isInProject
                  ? handleRemoveFromProject
                  : handleAddToProject,
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
          <p className="body-mini-b text-label-link">{t('Indexing...')}</p>
        ) : undefined
      }
      focusedItemProps={focusedItemProps}
      disableKeyNav={disableKeyNav}
    />
  );
};

export default memo(RepoItem);
