import React, { useCallback, useEffect, useState } from 'react';
import Breadcrumbs, { PathParts } from '../Breadcrumbs';
import {
  breadcrumbsItemPath,
  isWindowsPath,
  splitPathForBreadcrumbs,
} from '../../utils';
import { FileTreeFileType } from '../../types';
import useAppNavigation from '../../hooks/useAppNavigation';

type BProps = React.ComponentProps<typeof Breadcrumbs>;

type Props = {
  path: string;
  repo: string;
  onClick?: (path: string, fileType?: FileTreeFileType) => void;
  shouldGoToFile?: boolean;
  nonInteractive?: boolean;
} & Omit<BProps, 'pathParts'>;

const BreadcrumbsPath = ({
  path,
  onClick,
  repo,
  shouldGoToFile,
  ...rest
}: Props) => {
  const { navigateRepoPath, navigateFullResult } = useAppNavigation();
  const mapPath = useCallback(() => {
    return splitPathForBreadcrumbs(path, (e, item, index, pParts) => {
      e.stopPropagation();
      const isLastPart = index === pParts.length - 1;
      const newPath = breadcrumbsItemPath(
        pParts,
        index,
        isWindowsPath(path),
        isLastPart,
      );
      onClick?.(
        newPath,
        isLastPart ? FileTreeFileType.FILE : FileTreeFileType.DIR,
      );
      if (!isLastPart) {
        navigateRepoPath(repo, newPath);
      }
      if (shouldGoToFile && isLastPart) {
        navigateFullResult(path);
      }
    });
  }, [path, shouldGoToFile]);

  const [pathParts, setPathParts] = useState<PathParts[]>(mapPath());

  useEffect(() => {
    setPathParts(mapPath());
  }, [path]);

  return (
    <div className="overflow-hidden w-full">
      <Breadcrumbs {...rest} pathParts={pathParts} path={path} />
    </div>
  );
};
export default BreadcrumbsPath;
