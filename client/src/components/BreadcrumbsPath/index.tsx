import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs, { PathParts } from '../Breadcrumbs';
import {
  breadcrumbsItemPath,
  isWindowsPath,
  splitPathForBreadcrumbs,
} from '../../utils';
import { FileTreeFileType } from '../../types';

type BProps = React.ComponentProps<typeof Breadcrumbs>;

type Props = {
  path: string;
  repo: string;
  onClick?: (path: string, fileType?: FileTreeFileType) => void;
  shouldNavigate?: boolean;
} & Omit<BProps, 'pathParts'>;

const BreadcrumbsPath = ({
  path,
  onClick,
  repo,
  shouldNavigate,
  ...rest
}: Props) => {
  const navigate = useNavigate();
  const mapPath = useCallback(() => {
    return splitPathForBreadcrumbs(path, (e, item, index, pParts) => {
      const newPath = breadcrumbsItemPath(pParts, index, isWindowsPath(path));
      onClick?.(newPath, FileTreeFileType.DIR);
      shouldNavigate &&
        navigate(
          `/results?q=open:true repo:${encodeURIComponent(repo)} ${
            newPath.length ? `path:${encodeURIComponent(newPath)}` : ''
          }`,
        );
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
