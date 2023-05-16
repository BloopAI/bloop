import React, { useCallback, useEffect, useState } from 'react';
import { cleanRepoName, sortFiles } from '../../utils/file';
import RepositoryFiles from '../../components/RepositoryFiles';
import { search } from '../../services/api';
import { FileTreeFileType, RepositoryFile } from '../../types';
import useAppNavigation from '../../hooks/useAppNavigation';
import { DirectoryItem } from '../../types/api';
import { mapDirResult } from '../../mappers/results';

const Directory = ({ path, repo }: { path: string; repo: string }) => {
  const [files, setFiles] = useState<RepositoryFile[] | null>(null);
  const { navigateRepoPath, navigateFullResult } = useAppNavigation();

  useEffect(() => {
    search(`open:true repo:${repo} path:${path}`).then((resp) => {
      const data = mapDirResult(resp.data[0] as DirectoryItem);
      setFiles(data.entries.sort(sortFiles));
    });
  }, [path]);

  const fileClick = useCallback((path: string, type: FileTreeFileType) => {
    if (type === FileTreeFileType.FILE) {
      navigateFullResult(repo, path);
    } else if (type === FileTreeFileType.DIR) {
      navigateRepoPath(repo, path === '/' ? '' : path);
    }
  }, []);

  return (
    <div>
      {files && (
        <RepositoryFiles
          files={files}
          onClick={fileClick}
          repositoryName={cleanRepoName(repo)}
          currentPath={path}
        />
      )}
    </div>
  );
};

export default Directory;
