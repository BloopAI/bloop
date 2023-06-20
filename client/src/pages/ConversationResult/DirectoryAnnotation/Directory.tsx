import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sortFiles } from '../../../utils/file';
import { search } from '../../../services/api';
import { FileTreeFileType, RepositoryFile } from '../../../types';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { DirectoryItem } from '../../../types/api';
import { mapDirResult } from '../../../mappers/results';
import { colors } from '../CodeAnotation';
import {
  breadcrumbsItemPath,
  buildRepoQuery,
  isWindowsPath,
  splitPathForBreadcrumbs,
} from '../../../utils';
import Breadcrumbs, { PathParts } from '../../../components/Breadcrumbs';
import { Papers } from '../../../icons';
import FileRow from '../../../components/RepositoryFiles/FileRow';
import Button from '../../../components/Button';
import Accordion from '../../../components/Accordion';

type Props = {
  path: string;
  repo: string;
  i: number;
  isReady: boolean;
  isCollapsed?: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  isFullExpanded?: boolean;
  onFullExpand: () => void;
  onFullCollapse: () => void;
};
const fileHeight = 54.4;

const Directory = ({
  path,
  repo,
  i,
  isReady,
  onExpand,
  onCollapse,
  isFullExpanded,
  onFullExpand,
  onFullCollapse,
}: Props) => {
  const [files, setFiles] = useState<RepositoryFile[]>([]);
  const { navigateRepoPath, navigateFullResult } = useAppNavigation();

  useEffect(() => {
    if (isReady) {
      search(buildRepoQuery(repo, path)).then((resp) => {
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

  const pathParts = useMemo<PathParts[]>(() => {
    return splitPathForBreadcrumbs(path, (e, item, index, arr) => {
      e.stopPropagation();
      const pathToOpen = breadcrumbsItemPath(arr, index, isWindowsPath(path));
      fileClick(pathToOpen, FileTreeFileType.DIR);
    });
  }, [path, fileClick]);

  const fullHeight = useMemo(() => {
    return files.length * fileHeight + 16 + 56;
  }, [files]);

  const minimizedHeight = useMemo(() => {
    return 5 * fileHeight + 16;
  }, [files]);

  return (
    <div id={`code-${i}`} className="relative">
      <div
        className="absolute top-3 left-2 w-0.5 h-7 z-10"
        style={{
          backgroundColor: `rgb(${colors[i % colors.length].join(', ')})`,
        }}
      />
      <Accordion
        title={
          path === '' ? (
            'Files'
          ) : (
            <div className="flex-1 overflow-hidden">
              <Breadcrumbs pathParts={pathParts} path={path} />
            </div>
          )
        }
        icon={<Papers />}
        defaultExpanded
        onToggle={(bool) => (bool ? onExpand() : onCollapse())}
      >
        <div className="flex flex-col divide-y divide-bg-border overflow-auto bg-bg-sub select-none">
          <div
            className={`relative overflow-x-auto pt-4 ${
              isFullExpanded ? '' : 'overflow-y-hidden'
            } ${
              fullHeight <= minimizedHeight ? 'pb-4' : ''
            } transition-all duration-200 ease-linear`}
            style={
              fullHeight > minimizedHeight
                ? {
                    maxHeight: isFullExpanded ? fullHeight : minimizedHeight,
                  }
                : {}
            }
          >
            {files.map((file, id) => (
              <FileRow
                path={file.path}
                name={file.name}
                type={file.type}
                onClick={fileClick}
                key={id}
              />
            ))}
            {fullHeight > minimizedHeight && <div className="h-14" />}
            {fullHeight > minimizedHeight && (
              <div
                className={`bg-gradient-to-b from-transparent via-bg-sub/90 to-bg-sub pb-3 pt-6 
              absolute bottom-1 left-0 right-0 flex justify-center align-center`}
              >
                <Button
                  variant="secondary"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isFullExpanded) {
                      onFullCollapse();
                    } else {
                      onFullExpand();
                    }
                  }}
                >
                  Show {isFullExpanded ? 'less' : 'more'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Accordion>
    </div>
  );
};

export default Directory;
