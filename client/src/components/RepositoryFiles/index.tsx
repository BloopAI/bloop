import React, { useMemo } from 'react';
import { FileTreeFileType, RepositoryFile } from '../../types';
import Accordion from '../Accordion';
import { FolderFilled, Papers } from '../../icons';
import FileIcon from '../FileIcon';
import Breadcrumbs, { PathParts } from '../Breadcrumbs';
import {
  breadcrumbsItemPath,
  isWindowsPath,
  splitPathForBreadcrumbs,
} from '../../utils';

type Props = {
  files: RepositoryFile[];
  repositoryName: string;
  currentPath: string;
  onClick: (p: string, type: FileTreeFileType) => void;
};

const RepositoryFiles = ({
  files,
  currentPath,
  onClick,
  repositoryName,
}: Props) => {
  const pathParts = useMemo<PathParts[]>(() => {
    const parts = splitPathForBreadcrumbs(
      currentPath,
      (e, item, index, arr) => {
        const path = breadcrumbsItemPath(
          arr,
          index,
          isWindowsPath(currentPath),
        );
        onClick(path, FileTreeFileType.DIR);
      },
    );
    return [
      {
        label: repositoryName,
        onClick: () => onClick('/', FileTreeFileType.DIR),
      },
      ...parts,
    ];
  }, [currentPath, onClick, repositoryName]);

  return (
    <Accordion
      title={
        currentPath === '' ? (
          'Files'
        ) : (
          <div className="flex-1 overflow-hidden">
            <Breadcrumbs pathParts={pathParts} path={currentPath} />
          </div>
        )
      }
      icon={<Papers />}
    >
      <div className="flex flex-col divide-y divide-gray-700 text-gray-500 text-sm divide-y divide-gray-700 overflow-auto">
        {files.map((file, id) => (
          <span
            key={id}
            className="flex flex-row justify-between px-4 py-4  bg-gray-900 last:rounded-b group cursor-pointer"
            onClick={() => {
              onClick(file.path, file.type);
            }}
          >
            <span className="w-fit group-hover:text-gray-300 flex items-center gap-2">
              {file.type === FileTreeFileType.DIR ? (
                <FolderFilled />
              ) : (
                <FileIcon filename={file.name} />
              )}
              <span className="group-hover:underline">{file.name}</span>
            </span>
          </span>
        ))}
      </div>
    </Accordion>
  );
};
export default RepositoryFiles;
