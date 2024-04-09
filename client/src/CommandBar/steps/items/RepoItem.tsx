import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  CommandBarStepEnum,
  RepoIndexingStatusType,
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
import { RepositoriesContext } from '../../../context/repositoriesContext';

type Props = {
  repo: RepoUi;
  index: string;
  isFirst: boolean;
  refetchRepos: () => void;
  disableKeyNav?: boolean;
  indexingStatus?: RepoIndexingStatusType;
  tutorialPopup?: React.ReactElement;
  onSync?: () => void;
  onDone?: () => void;
  onAddToProject?: () => void;
};

const RepoItem = ({
  repo,
  isFirst,
  index,
  refetchRepos,
  disableKeyNav,
  indexingStatus,
  onSync,
  onDone,
  onAddToProject,
}: Props) => {
  const { t } = useTranslation();
  const { project, refreshCurrentProjectRepos } = useContext(
    ProjectContext.Current,
  );
  const { openFolderInExplorer, os, openLink } = useContext(DeviceContext);

  const onRepoSync = useCallback(
    async (e?: MouseEvent | KeyboardEvent | React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      await syncRepo(repo.ref);
      onSync?.();
    },
    [repo.ref, onSync],
  );

  const status = useMemo(() => {
    return indexingStatus?.status || repo.sync_status;
  }, [indexingStatus]);

  useEffect(() => {
    if (status === SyncStatus.Done) {
      onDone?.();
    }
  }, [status]);

  const handleAddToProject = useCallback(() => {
    if (project?.id) {
      onAddToProject?.();
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
      index={index}
      isFirst={isFirst}
      itemKey={`repo-${repo.ref}`}
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
            {indexingStatus?.percentage !== null &&
              indexingStatus?.percentage !== undefined &&
              ` · ${indexingStatus?.percentage}%`}
          </p>
        ) : undefined
      }
      focusedItemProps={focusedItemProps}
      disableKeyNav={disableKeyNav}
    />
  );
};

const WithIndexingStatus = (props: Omit<Props, 'indexingStatus'>) => {
  const { indexingStatus } = useContext(RepositoriesContext);
  const repoIndexingStatus = useMemo(() => {
    return indexingStatus[props.repo.ref];
  }, [indexingStatus[props.repo.ref]]);

  return <RepoItem {...props} indexingStatus={repoIndexingStatus} />;
};

export default memo(WithIndexingStatus);
