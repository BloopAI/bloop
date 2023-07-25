import { format as timeAgo } from 'timeago.js';
import { MouseEvent, useCallback, useContext, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  GitHubLogo,
  MoreVertical,
  TrashCan,
  CloseSign,
  Eye,
} from '../../icons';
import { MenuItemType, SyncStatus } from '../../types/general';
import FileIcon from '../FileIcon';
import { getFileExtensionForLang } from '../../utils';
import BarLoader from '../Loaders/BarLoader';
import { UIContext } from '../../context/uiContext';
import { TabsContext } from '../../context/tabsContext';
import Dropdown from '../Dropdown/WithIcon';
import { deleteRepo, cancelSync, syncRepo } from '../../services/api';
import { RepoSource } from '../../types';
import { LocaleContext } from '../../context/localeContext';

type Props = {
  name: string;
  description?: string;
  sync_status: SyncStatus;
  last_index: string;
  lang: string;
  repoRef: string;
  provider: 'local' | 'github';
  syncStatus?: { percentage: number } | null;
  onDelete: () => void;
  indexedBranches?: string[];
};

export const STATUS_MAP = {
  [SyncStatus.Error]: { text: 'Error', color: 'bg-red-500' },
  [SyncStatus.Removed]: { text: 'Removed', color: 'bg-red-500' },
  [SyncStatus.Uninitialized]: { text: 'Not synced', color: 'bg-bg-shade' },
  [SyncStatus.Queued]: { text: 'Queued...', color: 'bg-bg-shade' },
  [SyncStatus.Cancelled]: { text: 'Cancelled', color: 'bg-bg-shade' },
  [SyncStatus.Cancelling]: { text: 'Cancelling...', color: 'bg-yellow' },
  [SyncStatus.Indexing]: { text: 'Indexing...', color: 'bg-yellow' },
  [SyncStatus.Syncing]: { text: 'Cloning...', color: 'bg-yellow' },
  [SyncStatus.Done]: { text: 'Last updated ', color: 'bg-green-500' },
  [SyncStatus.RemoteRemoved]: { text: 'Remote removed ', color: 'bg-red-500' },
};

const RepoCard = ({
  name,
  sync_status,
  last_index,
  lang,
  provider,
  syncStatus,
  repoRef,
  onDelete,
  indexedBranches,
}: Props) => {
  const { t } = useTranslation();
  const { isGithubConnected } = useContext(UIContext);
  const { locale } = useContext(LocaleContext);
  const { handleAddTab, tabs, handleRemoveTab } = useContext(TabsContext);
  const isGh = useMemo(() => provider === 'github', [provider]);
  const repoName = useMemo(() => {
    return !isGh ? name.split('/').reverse()[0] : name;
  }, [name, provider]);

  const handleClick = useCallback(() => {
    if (!last_index || last_index === '1970-01-01T00:00:00Z') {
      return;
    }
    handleAddTab(
      repoRef,
      isGh ? repoRef : repoName,
      repoName,
      isGh ? RepoSource.GH : RepoSource.LOCAL,
      indexedBranches?.[0],
    );
  }, [repoName, provider, isGithubConnected, sync_status, last_index]);

  const onRepoRemove = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      deleteRepo(repoRef);
      if (tabs.find((t) => t.key === repoRef)) {
        handleRemoveTab(repoRef);
      }
      onDelete();
    },
    [repoRef, tabs],
  );

  const onCancelSync = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      cancelSync(repoRef);
    },
    [repoRef],
  );

  const onSync = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      syncRepo(repoRef);
    },
    [repoRef],
  );

  const dropdownItems = useMemo(() => {
    const items = [
      {
        type: MenuItemType.DANGER,
        text: t('Remove'),
        icon: <TrashCan />,
        onClick: onRepoRemove,
      },
    ];

    if (
      sync_status !== SyncStatus.Indexing &&
      sync_status !== SyncStatus.Syncing &&
      sync_status !== SyncStatus.Queued
    ) {
      items.push({
        type: MenuItemType.DEFAULT,
        text: t('Re-sync'),
        icon: <Eye />,
        onClick: onSync,
      });
    }

    if (
      sync_status === SyncStatus.Indexing ||
      sync_status === SyncStatus.Syncing
    ) {
      items.push({
        type: MenuItemType.DANGER,
        text: t('Cancel'),
        icon: <CloseSign />,
        onClick: onCancelSync,
      });
    }

    return items;
  }, [sync_status, onRepoRemove, onSync, onCancelSync]);

  return (
    <div
      className={`bg-bg-base hover:bg-bg-base-hover border border-bg-border rounded-md p-4 w-67 h-36 group
       flex-shrink-0 flex flex-col justify-between cursor-pointer transition-all duration-150`}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-4">
          <span className="h-6 flex items-center mt-1">
            <FileIcon filename={getFileExtensionForLang(lang)} />
          </span>
          <p className="break-all text-label-title pt-0.5">{repoName}</p>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-all duration-150">
          <Dropdown
            icon={<MoreVertical />}
            noChevron
            btnSize="small"
            size="small"
            btnOnlyIcon
            btnVariant="secondary"
            dropdownPlacement="bottom-end"
            items={dropdownItems}
          />
        </div>
      </div>
      {(sync_status === SyncStatus.Indexing ||
        sync_status === SyncStatus.Syncing) &&
      syncStatus ? (
        <div className="flex flex-col gap-2">
          <p className="body-s text-label-title">
            <Trans>Indexing...</Trans>
          </p>
          <BarLoader percentage={syncStatus.percentage} />
          <p className="caption text-label-muted">
            {syncStatus.percentage}% <Trans>complete</Trans>
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 caption text-label-base">
          {isGh && (
            <div className="w-4 h-4 ">
              <GitHubLogo raw />
            </div>
          )}
          <span
            className={`w-2 h-2 ${
              STATUS_MAP[
                typeof sync_status === 'string' ? sync_status : 'error'
              ]?.color || 'bg-yellow'
            } rounded-full`}
          />
          <p className="select-none">
            {t(
              STATUS_MAP[
                typeof sync_status === 'string' ? sync_status : 'error'
              ]?.text || sync_status,
            )}
            {sync_status === 'done' && timeAgo(last_index, locale)}
          </p>
        </div>
      )}
    </div>
  );
};

export default RepoCard;
