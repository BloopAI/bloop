import React, { useCallback, useEffect, useState } from 'react';
import { cleanRepoName, sortFiles } from '../../../utils/file';
import RepositoryFiles from '../../../components/RepositoryFiles';
import { search } from '../../../services/api';
import { FileTreeFileType, RepositoryFile } from '../../../types';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { DirectoryItem } from '../../../types/api';
import { mapDirResult } from '../../../mappers/results';
import { colors } from '../CodeAnotation';

type Props = {
  path: string;
  repo: string;
  i: number;
  isReady: boolean;
};

const Directory = ({ path, repo, i, isReady }: Props) => {
  const [files, setFiles] = useState<RepositoryFile[]>([]);
  const { navigateRepoPath, navigateFullResult } = useAppNavigation();

  useEffect(() => {
    if (isReady) {
      search(`open:true repo:${repo} path:${path}`).then((resp) => {
        if (resp.data?.[0]) {
          const data = mapDirResult(resp.data[0] as DirectoryItem);
          setFiles(data.entries.sort(sortFiles));
        }
      });
    }
  }, [path, isReady]);

  const fileClick = useCallback((path: string, type: FileTreeFileType) => {
    if (type === FileTreeFileType.FILE) {
      navigateFullResult(repo, path);
    } else if (type === FileTreeFileType.DIR) {
      navigateRepoPath(repo, path === '/' ? '' : path);
    }
  }, []);

  return (
    <div id={`code-${i}`} className="relative">
      <div
        className="absolute top-2 left-2 w-0.5 h-6 z-10"
        style={{
          backgroundColor: `rgb(${colors[i % colors.length].join(', ')})`,
        }}
      />
      <RepositoryFiles
        files={files}
        onClick={fileClick}
        repositoryName={cleanRepoName(repo)}
        currentPath={path}
        maxInitialFiles={5}
        noRepoName
      />
    </div>
  );
};

export default Directory;
