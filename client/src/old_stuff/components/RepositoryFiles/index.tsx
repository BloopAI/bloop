import React, { memo, useCallback, useContext, useMemo } from 'react';
import { Trans } from 'react-i18next';
import { FileTreeFileType, RepositoryFile } from '../../../types';
import Accordion from '../Accordion';
import { Papers } from '../../../icons';
import Breadcrumbs, { PathParts } from '../../../components/Breadcrumbs';
import {
  breadcrumbsItemPath,
  isWindowsPath,
  splitPathForBreadcrumbs,
} from '../../../utils';
import { UIContext } from '../../../context/uiContext';
import { SyncStatus } from '../../types/general';
import { forceFileToBeIndexed } from '../../../services/api';
import FileRow from './FileRow';

type Props = {
  files: RepositoryFile[];
  repositoryName: string;
  currentPath: string;
  onClick: (p: string, type: FileTreeFileType) => void;
  maxInitialFiles?: number;
  noRepoName?: boolean;
  repoStatus: SyncStatus;
  markRepoIndexing: () => void;
};

const RepositoryFiles = ({
  files,
  currentPath,
  onClick,
  repositoryName,
  maxInitialFiles,
  noRepoName,
  repoStatus,
  markRepoIndexing,
}: Props) => {
  const { tab } = useContext(UIContext.Tab);
  const pathParts = useMemo<PathParts[]>(() => {
    const parts = splitPathForBreadcrumbs(
      currentPath,
      (e, item, index, arr) => {
        e.stopPropagation();
        const path = breadcrumbsItemPath(
          arr,
          index,
          isWindowsPath(currentPath),
        );
        onClick(path, FileTreeFileType.DIR);
      },
    );
    return [
      ...(!noRepoName
        ? [
            {
              label: repositoryName,
              onClick: (e) => {
                e.stopPropagation();
                onClick('/', FileTreeFileType.DIR);
              },
            } as PathParts,
          ]
        : []),
      ...parts,
    ];
  }, [currentPath, onClick, repositoryName]);

  const onFileIndexRequested = useCallback(
    (filePath: string) => {
      forceFileToBeIndexed(tab.repoRef, filePath);
      markRepoIndexing();
    },
    [tab.repoRef, markRepoIndexing],
  );

  return (
    <Accordion
      title={
        currentPath === '' ? (
          <Trans>Files</Trans>
        ) : (
          <div className="flex-1 overflow-hidden">
            <Breadcrumbs pathParts={pathParts} path={currentPath} />
          </div>
        )
      }
      icon={<Papers />}
      defaultExpanded={!maxInitialFiles || files.length <= maxInitialFiles}
      shownItems={
        maxInitialFiles && files.length > maxInitialFiles ? (
          <div className="flex flex-col divide-y divide-bg-border border-b border-bg-border overflow-auto bg-bg-sub">
            {files.slice(0, maxInitialFiles).map((file, id) => (
              <FileRow
                path={file.path}
                name={file.name}
                type={file.type}
                indexed={file.indexed}
                onFileIndexRequested={onFileIndexRequested}
                repoStatus={repoStatus}
                onClick={onClick}
                key={id}
              />
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col divide-y divide-bg-border overflow-auto bg-bg-sub select-none">
        {(maxInitialFiles && files.length > maxInitialFiles
          ? files.slice(maxInitialFiles)
          : files
        ).map((file, id) => (
          <FileRow
            path={file.path}
            name={file.name}
            type={file.type}
            indexed={file.indexed}
            onFileIndexRequested={onFileIndexRequested}
            repoStatus={repoStatus}
            onClick={onClick}
            key={id}
          />
        ))}
        {!!maxInitialFiles && files.length > maxInitialFiles && (
          <div className="h-13 w-full" />
        )}
      </div>
    </Accordion>
  );
};
export default memo(RepositoryFiles);
