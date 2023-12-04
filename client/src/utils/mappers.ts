import { RepoProvider, RepoType, RepoUi, SyncStatus } from '../types/general';
import { splitPath } from './index';

export const mapReposBySections = (githubRepos: RepoType[]) => {
  const byOrg: Record<string, RepoUi[]> = {};
  githubRepos.forEach((r) => {
    const pathParts = splitPath(r.name);
    const repoUI = {
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
    };
    const sectionName =
      r.provider === RepoProvider.Local ? 'Local' : pathParts[0];
    if (!byOrg[sectionName]) {
      byOrg[sectionName] = [];
    }
    byOrg[sectionName].push(repoUI);
  });
  const result: { org: string; items: RepoUi[]; offset: number }[] = [];
  Object.keys(byOrg)
    .sort((a, b) =>
      a === 'Local'
        ? 1
        : b === 'Local'
        ? -1
        : a.toLowerCase() < b.toLowerCase()
        ? -1
        : 1,
    )
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
