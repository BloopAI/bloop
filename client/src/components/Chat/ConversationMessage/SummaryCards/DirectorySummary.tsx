import React, { useEffect, useState } from 'react';
import { FileTreeFileType, RepositoryFile } from '../../../../types';
import { search } from '../../../../services/api';
import { buildRepoQuery } from '../../../../utils';
import { mapDirResult } from '../../../../mappers/results';
import { DirectoryItem } from '../../../../types/api';
import { sortFiles } from '../../../../utils/file';
import { FolderClosed, FolderFilled } from '../../../../icons';
import FileIcon from '../../../FileIcon';

type Props = {
  path: string | null;
  repoName: string;
};

const DirectorySummary = ({ path, repoName }: Props) => {
  const [files, setFiles] = useState<RepositoryFile[]>([]);

  useEffect(() => {
    if (path && repoName) {
      search(buildRepoQuery(repoName, path)).then((resp) => {
        if (resp.data?.[0]) {
          const data = mapDirResult(resp.data[0] as DirectoryItem);
          setFiles(data.entries.sort(sortFiles));
        }
      });
    }
  }, [path, repoName]);

  return (
    <div className="w-full">
      <div className="flex gap-2 items-center w-full text-label-title caption p-2">
        <FolderClosed raw sizeClassName="w-4 h-4" />
        {path?.replace(/[\/\\]$/, '')}
      </div>
      <div className="bg-chat-bg-sub">
        {files.map((file, i) => (
          <span
            key={file.name}
            className="flex flex-row justify-between px-2 py-1 last:rounded-b border-b border-chat-bg-divider text-label-base body-s"
          >
            <span className="w-fit flex items-center gap-2">
              {file.type === FileTreeFileType.DIR ? (
                <FolderFilled />
              ) : (
                <FileIcon filename={file.name} />
              )}
              <span>{file.name}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default DirectorySummary;
