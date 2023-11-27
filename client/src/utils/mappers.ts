import { RepoType, RepoUi, SyncStatus } from '../types/general';
import { splitPath } from './index';

export const mapGitHubRepos = (githubRepos: RepoType[]) => {
  const byOrg: Record<string, RepoUi[]> = {};
  githubRepos.forEach((r) => {
    const pathParts = splitPath(r.name);
    if (!byOrg[pathParts[0]]) {
      byOrg[pathParts[0]] = [];
    }
    byOrg[pathParts[0]].push({
      ...r,
      shortName: pathParts[pathParts.length - 1],
      folderName: pathParts[0],
      alreadySynced: ![
        SyncStatus.Uninitialized,
        SyncStatus.Removed,
        SyncStatus.Syncing,
        SyncStatus.Indexing,
        SyncStatus.Queued,
      ].includes(r.sync_status),
      isSyncing: [
        SyncStatus.Syncing,
        SyncStatus.Indexing,
        SyncStatus.Queued,
      ].includes(r.sync_status),
    });
  });
  const result: { org: string; items: RepoUi[]; offset: number }[] = [];
  Object.keys(byOrg)
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
    .forEach((k) => {
      result.push({
        org: k,
        items: byOrg[k].sort((a, b) =>
          a.folderName.toLowerCase() < b.folderName.toLowerCase()
            ? -1
            : a.folderName.toLowerCase() > b.folderName.toLowerCase()
            ? 1
            : a.shortName.toLowerCase() < b.shortName.toLowerCase()
            ? -1
            : 1,
        ),
        offset: result[result.length - 1]
          ? result[result.length - 1].offset +
            result[result.length - 1].items.length
          : 0,
      });
    });
  return result;
};
