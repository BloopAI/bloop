import React from 'react';
import { FileTreeFileType, RepositoryFile } from '../../types';
import Accordion from '../Accordion';
import { FolderFilled, Papers } from '../../icons';
import FileIcon from '../FileIcon';
import Breadcrumbs from '../Breadcrumbs';
import {
  breadcrumbsItemPath,
  isWindowsPath,
  splitPathForBreadcrumbs,
} from '../../utils';

type Props = {
  files: RepositoryFile[];
  currentPath: string;
  onClick: (p: string, shouldReplace?: boolean) => void;
};

const RepositoryFiles = ({ files, currentPath, onClick }: Props) => {
  return (
    <Accordion
      title={
        currentPath === '' ? (
          'Files'
        ) : (
          <div className="flex-1 overflow-hidden">
            <Breadcrumbs
              pathParts={splitPathForBreadcrumbs(
                currentPath,
                (e, item, index, arr) => {
                  const path = index
                    ? breadcrumbsItemPath(
                        arr.slice(1),
                        index - 1,
                        isWindowsPath(currentPath),
                      )
                    : '';
                  onClick(path);
                },
              )}
              path={currentPath}
            />
          </div>
        )
      }
      icon={<Papers />}
    >
      <div className="flex flex-col divide-y divide-gray-700 text-gray-500 text-sm divide-y divide-gray-700 overflow-auto">
        {files.map((file, id) => (
          <span
            key={id}
            className="flex flex-row justify-between px-4 py-4  bg-gray-900 last:rounded-b"
            onClick={() => {
              onClick(file.path, true);
            }}
          >
            <span className="w-fit hover:text-gray-300 flex items-center gap-2">
              {file.type === FileTreeFileType.DIR ? (
                <FolderFilled />
              ) : (
                <FileIcon filename={file.name} />
              )}
              <span className="hover:underline cursor-pointer ">
                {file.name}
              </span>
            </span>
          </span>
        ))}
      </div>
    </Accordion>
  );
};
export default RepositoryFiles;
