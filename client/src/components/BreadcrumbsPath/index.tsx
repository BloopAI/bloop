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
} & Omit<BProps, 'pathParts'>;

const BreadcrumbsPath = ({ path, onClick, repo, ...rest }: Props) => {
  const { navigateRepoPath } = useAppNavigation();
  const mapPath = useCallback(() => {
    return splitPathForBreadcrumbs(path, (e, item, index, pParts) => {
      const newPath = breadcrumbsItemPath(pParts, index, isWindowsPath(path));
      onClick?.(newPath, FileTreeFileType.DIR);
      navigateRepoPath(repo, newPath);
    });
  }, [path]);

  const [pathParts, setPathParts] = useState<PathParts[]>(mapPath());

  useEffect(() => {
    setPathParts(mapPath());
  }, [path]);

  return (
    <div className="overflow-hidden">
      <Breadcrumbs {...rest} pathParts={pathParts} path={path} />
    </div>
  );
};
export default BreadcrumbsPath;
