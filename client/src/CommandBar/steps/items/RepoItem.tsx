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
import { getFileManagerName } from '../../../utils';
import Item from '../../Body/Item';
import SpinLoaderContainer from '../../../components/Loaders/SpinnerLoader';
import { ProjectContext } from '../../../context/projectContext';
import { repoStatusMap } from '../../../consts/general';

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
  const { project, refreshCurrentProjectRepos } = useContext(
    ProjectContext.Current,
  );
  const [status, setStatus] = useState(repo.sync_status);
  const [indexingPercent, setIndexingPercent] = useState<null | number>(null);
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
        if (data.ref === repo.ref) {
          if (data.ev?.status_change) {
            setStatus(data.ev?.status_change);
            if (data.ev?.status_change === SyncStatus.Done) {
              eventSourceRef.current?.close();
              eventSourceRef.current = null;
              refetchRepos();
            }
          }
          if (
            Number.isInteger(data.ev?.index_percent) ||
            data.ev?.index_percent === null
          ) {
            setIndexingPercent(data.ev.index_percent);
          }
        }
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
    await syncRepo(repo.ref);
    setStatus(SyncStatus.Queued);
    startEventSource();
  }, [repo.ref]);

  const handleAddToProject = useCallback(() => {
    if (project?.id) {
      return addRepoToProject(
        project.id,
        repo.ref,
        repo.branch_filter?.select?.[0],
      ).finally(() => {
        refreshCurrentProjectRepos();
      });
    }
  }, [repo]);

  const handleOpenInFinder = useCallback(() => {
    openFolderInExplorer(repo.ref.slice(6));
  }, [openFolderInExplorer, repo.ref]);

  const handleOpenInGitHub = useCallback(() => {
    openLink('https://' + repo.ref);
  }, [openLink, repo.ref]);

  const handleRemoveFromProject = useCallback(() => {
    if (project?.id) {
      return removeRepoFromProject(project.id, repo.ref).finally(() => {
        refreshCurrentProjectRepos();
      });
    }
  }, [repo]);

  const handleCancelSync = useCallback(() => {
    cancelSync(repo.ref);
    setStatus(SyncStatus.Cancelled);
    eventSourceRef.current?.close();
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
    return project?.repos.find((r) => r.repo.ref === repo.ref);
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
    if (status === SyncStatus.Done || status === SyncStatus.Cancelled) {
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
    status,
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
        status === SyncStatus.Done || status === SyncStatus.Cancelled
          ? 'bg-bg-contrast text-label-contrast'
          : 'bg-bg-border'
      }
      isWithCheckmark={!!isInProject}
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
        status === SyncStatus.Done || status === SyncStatus.Cancelled
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
          <p className="body-mini-b text-label-link">
            {t(repoStatusMap[status].text)}
            {indexingPercent !== null && `· ${indexingPercent}%`}
          </p>
        ) : undefined
      }
      focusedItemProps={focusedItemProps}
      disableKeyNav={disableKeyNav}
    />
  );
};

export default memo(RepoItem);
