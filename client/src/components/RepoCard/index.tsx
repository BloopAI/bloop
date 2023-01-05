import { format as timeAgo } from 'timeago.js';
import { useCallback, useMemo } from 'react';
import { GitHubLogo } from '../../icons';
import { SyncStatus } from '../../types/general';
import FileIcon from '../FileIcon';
import { getFileExtensionForLang } from '../../utils';
import useAppNavigation from '../../hooks/useAppNavigation';

type Props = {
  name: string;
  description?: string;
  sync_status: SyncStatus;
  last_update: string;
  lang: string;
  provider: 'local' | 'github';
};

const statusMap = {
  error: { text: 'Error', color: 'bg-red-500' },
  removed: { text: 'Removed', color: 'bg-red-500' },
  uninitialized: { text: 'Not synced', color: 'bg-gray-700' },
  queued: { text: 'Queued...', color: 'bg-gray-700' },
  indexing: { text: 'Indexing...', color: 'bg-yellow-500' },
  syncing: { text: 'Syncing...', color: 'bg-yellow-500' },
  done: { text: 'Last updated ', color: 'bg-green-500' },
};

const RepoCard = ({
  name,
  description,
  sync_status,
  last_update,
  lang,
  provider,
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
      <div className="flex items-center gap-2 caption text-gray-500">
        <div className="w-4 h-4 ">
          <GitHubLogo raw />
        </div>
        <span
          className={`w-2 h-2 ${
            statusMap[typeof sync_status === 'string' ? sync_status : 'error']
              ?.color || 'bg-yellow-500'
          } rounded-full`}
        />
        <p className="select-none">
          {statusMap[typeof sync_status === 'string' ? sync_status : 'error']
            ?.text || sync_status}
          {sync_status === 'done' && timeAgo(last_update)}
        </p>
      </div>
    </div>
  );
};

export default RepoCard;
