import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Directory, DirectoryEntry } from '../../types/api';
import { AppNavigationContext } from '../../context/appNavigationContext';
import { UIContext } from '../../context/uiContext';
import { search } from '../../services/api';
import { buildRepoQuery } from '../../utils';
import { SearchContext } from '../../context/searchContext';
import NavigationPanel from './NavigationPanel';
import DirEntry from './DirEntry';

const IdeNavigation = () => {
  const { navigatedItem } = useContext(AppNavigationContext);
  const { tab } = useContext(UIContext);
  const { selectedBranch } = useContext(SearchContext);
  const [files, setFiles] = useState<DirectoryEntry[]>([]);
  const { navigateRepoPath } = useContext(AppNavigationContext);

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

  useEffect(() => {
    fetchFiles().then(setFiles);
  }, [fetchFiles]);

  const navigateToPath = useCallback(
    (path: string) => {
      navigateRepoPath(tab.repoName, path);
    },
    [tab.repoName, navigateRepoPath],
  );

  return (
    <NavigationPanel repoName={tab.repoName}>
      {files.map((f) => (
        <DirEntry
          key={f.name}
          name={f.name}
          isDirectory={f.entry_data === 'Directory'}
          level={1}
          currentPath={navigatedItem?.path || ''}
          fetchFiles={fetchFiles}
          fullPath={f.name}
          navigateToPath={navigateToPath}
        />
      ))}
    </NavigationPanel>
  );
};
export default IdeNavigation;
