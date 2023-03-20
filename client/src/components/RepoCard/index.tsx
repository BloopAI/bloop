import { format as timeAgo } from 'timeago.js';
import { useCallback, useMemo } from 'react';
import { GitHubLogo } from '../../icons';
import { SyncStatus } from '../../types/general';
import FileIcon from '../FileIcon';
import { getFileExtensionForLang } from '../../utils';
import useAppNavigation from '../../hooks/useAppNavigation';
import BarLoader from '../Loaders/BarLoader';

type Props = {
  name: string;
  description?: string;
  sync_status: SyncStatus;
  last_update: string;
  lang: string;
  provider: 'local' | 'github';
  isSyncing?: boolean;
  syncStatus?: { indexStep: number; percentage: number } | null;
};

export const STATUS_MAP = {
  [SyncStatus.Error]: { text: 'Error', color: 'bg-red-500' },
  [SyncStatus.Removed]: { text: 'Removed', color: 'bg-red-500' },
  [SyncStatus.Uninitialized]: { text: 'Not synced', color: 'bg-gray-700' },
  [SyncStatus.Queued]: { text: 'Queued...', color: 'bg-gray-700' },
  [SyncStatus.Indexing]: { text: 'Indexing...', color: 'bg-yellow-500' },
  [SyncStatus.Syncing]: { text: 'Syncing...', color: 'bg-yellow-500' },
  [SyncStatus.Done]: { text: 'Last updated ', color: 'bg-green-500' },
  [SyncStatus.RemoteRemoved]: { text: 'Remote removed ', color: 'bg-red-500' },
};

const RepoCard = ({
  name,
  description,
  sync_status,
  last_update,
  lang,
  provider,
  isSyncing,
  syncStatus,
}: Props) => {
  const isGh = useMemo(() => provider === 'github', [provider]);
  const repoName = useMemo(() => {
    return !isGh ? name.split('/').reverse()[0] : name;
  }, [name, provider]);

  const { navigateRepoPath } = useAppNavigation();
  const handleClick = useCallback(() => {
    navigateRepoPath(`${isGh ? 'github.com/' : ''}${repoName}`);
  }, [repoName, provider]);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-md p-4 w-full flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <span className="h-6 flex items-center">
          <FileIcon filename={getFileExtensionForLang(lang)} />
        </span>
        <p className="cursor-pointer break-all" onClick={handleClick}>
          {repoName}
        </p>
      </div>
      <p className="body-s text-gray-500">{description}</p>
      {isSyncing &&
      syncStatus &&
      (syncStatus.indexStep === 0 || syncStatus.percentage < 100) ? (
        <div className="flex flex-col gap-2">
          <p className="body-s text-gray-200">Syncing...</p>
          <BarLoader
            percentage={syncStatus.indexStep === 1 ? syncStatus.percentage : 1}
          />
          <p className="caption text-gray-500">
            {syncStatus.indexStep === 1 ? syncStatus.percentage : 1}% complete
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 caption text-gray-500">
          <div className="w-4 h-4 ">
            <GitHubLogo raw />
          </div>
          <span
            className={`w-2 h-2 ${
              STATUS_MAP[
                typeof sync_status === 'string' ? sync_status : 'error'
              ]?.color || 'bg-yellow-500'
            } rounded-full`}
          />
          <p className="select-none">
            {STATUS_MAP[typeof sync_status === 'string' ? sync_status : 'error']
              ?.text || sync_status}
            {sync_status === 'done' && timeAgo(last_update)}
          </p>
        </div>
      )}
    </div>
  );
};

export default RepoCard;
