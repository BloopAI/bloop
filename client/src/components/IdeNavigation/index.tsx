import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Directory, DirectoryEntry } from '../../types/api';
import { AppNavigationContext } from '../../context/appNavigationContext';
import { UIContext } from '../../context/uiContext';
import { search } from '../../services/api';
import { buildRepoQuery } from '../../utils';
import { SearchContext } from '../../context/searchContext';
import { RepoType, SyncStatus } from '../../types/general';
import { RepositoriesContext } from '../../context/repositoriesContext';
import NavigationPanel from './NavigationPanel';
import DirEntry from './DirEntry';

const IdeNavigation = () => {
  const { navigatedItem } = useContext(AppNavigationContext);
  const { tab } = useContext(UIContext.Tab);
  const { selectedBranch } = useContext(SearchContext.SelectedBranch);
  const [files, setFiles] = useState<DirectoryEntry[]>([]);
  const { navigateFullResult } = useContext(AppNavigationContext);
  const { repositories, setRepositories } = useContext(RepositoriesContext);

  const fetchFiles = useCallback(
    async (path?: string) => {
      const resp = await search(
        buildRepoQuery(tab.repoName, path, selectedBranch),
      );
      if (!resp.data?.[0]?.data) {
        return [];
      }
      return (resp.data[0].data as Directory)?.entries.sort((a, b) => {
        if ((a.entry_data === 'Directory') === (b.entry_data === 'Directory')) {
          return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        } else {
          return a.entry_data === 'Directory' ? -1 : 1;
        }
      });
    },
    [tab.repoName, selectedBranch],
  );

  const repoStatus = useMemo(() => {
    return (
      repositories?.find((r) => r.ref === tab.repoRef)?.sync_status ||
      SyncStatus.Done
    );
  }, [repositories, tab.repoRef]);

  const refetchParentFolder = useCallback(() => {
    fetchFiles().then(setFiles);
  }, []);

  useEffect(() => {
    refetchParentFolder();
  }, [refetchParentFolder]);

  const navigateToPath = useCallback(
    (path: string) => {
      navigateFullResult(path);
    },
    [tab.repoName, navigateFullResult],
  );

  const markRepoIndexing = useCallback(() => {
    setRepositories((prev) => {
      const newRepos: RepoType[] = JSON.parse(JSON.stringify(prev)) || [];
      const repoInd = newRepos.findIndex((r) => r.ref === tab.repoRef);
      newRepos[repoInd].sync_status = SyncStatus.Indexing;
      return newRepos;
    });
  }, [tab.repoRef]);

  return (
    <NavigationPanel repoName={tab.repoName}>
      {files.map((f) => (
        <DirEntry
          key={f.name}
          name={f.name}
          indexed={
            f.entry_data !== 'Directory' ? f.entry_data.File.indexed : true
          }
          isDirectory={f.entry_data === 'Directory'}
          level={1}
          currentPath={navigatedItem?.path || ''}
          fetchFiles={fetchFiles}
          fullPath={f.name}
          navigateToPath={navigateToPath}
          repoRef={tab.repoRef}
          repoStatus={repoStatus}
          refetchParentFolder={refetchParentFolder}
          markRepoIndexing={markRepoIndexing}
        />
      ))}
    </NavigationPanel>
  );
};
export default IdeNavigation;
