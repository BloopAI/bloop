import { format as timeAgo } from 'timeago.js';
import { useCallback, useContext, useMemo } from 'react';
import { GitHubLogo } from '../../icons';
import { SearchType, SyncStatus } from '../../types/general';
import FileIcon from '../FileIcon';
import { getFileExtensionForLang } from '../../utils';
import useAppNavigation from '../../hooks/useAppNavigation';
import { UIContext } from '../../context/uiContext';
import { AnalyticsContext } from '../../context/analyticsContext';

type Props = {
  name: string;
  description?: string;
  sync_status: SyncStatus;
  last_update: string;
  lang: string;
  provider: 'local' | 'github';
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
}: Props) => {
  const { isGithubConnected } = useContext(UIContext);
  const { isAnalyticsAllowed } = useContext(AnalyticsContext);
  const isGh = useMemo(() => provider === 'github', [provider]);
  const repoName = useMemo(() => {
    return !isGh ? name.split('/').reverse()[0] : name;
  }, [name, provider]);

  const { navigateRepoPath, navigateSearch } = useAppNavigation();
  const handleClick = useCallback(() => {
    if (isGithubConnected && isAnalyticsAllowed) {
      navigateSearch(
        `What does this repo do? repo:${repoName} lang:markdown`,
        SearchType.NL,
      );
    } else {
      navigateRepoPath(`${isGh ? 'github.com/' : ''}${repoName}`);
    }
  }, [repoName, provider, isGithubConnected, isAnalyticsAllowed]);

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
            STATUS_MAP[typeof sync_status === 'string' ? sync_status : 'error']
              ?.color || 'bg-yellow-500'
          } rounded-full`}
        />
        <p className="select-none">
          {STATUS_MAP[typeof sync_status === 'string' ? sync_status : 'error']
            ?.text || sync_status}
          {sync_status === 'done' && timeAgo(last_update)}
        </p>
      </div>
    </div>
  );
};

export default RepoCard;
