import React, { memo, useMemo } from 'react';
import {
  breadcrumbsItemPath,
  isWindowsPath,
  splitPathForBreadcrumbs,
} from '../../utils';
import { FileTreeFileType } from '../../types';
import Breadcrumbs, { PathParts } from './index';

type BProps = React.ComponentProps<typeof Breadcrumbs>;

type Props = {
  path: string;
  repo: string;
  onClick?: (path: string, fileType?: FileTreeFileType) => void;
  shouldGoToFile?: boolean;
  nonInteractive?: boolean;
  allowOverflow?: boolean;
  scrollContainerRef?: React.MutableRefObject<HTMLDivElement | null>;
} & Omit<BProps, 'pathParts'>;

const BreadcrumbsPathContainer = ({
  path,
  onClick,
  repo,
  shouldGoToFile,
  allowOverflow,
  scrollContainerRef,
  ...rest
}: Props) => {
  const pathParts: PathParts[] = useMemo(() => {
    return splitPathForBreadcrumbs(path, (e, item, index, pParts) => {
      if (onClick) {
        e?.stopPropagation();
      }
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
        // navigateRepoPath(repo, newPath);
      }
      if (shouldGoToFile && isLastPart) {
        // navigateFullResult(path);
      }
    });
  }, [path, shouldGoToFile, onClick, repo]);

  return (
    <div
      className={`${
        allowOverflow ? 'overflow-auto' : 'overflow-hidden'
      } w-full`}
      ref={scrollContainerRef}
    >
      <Breadcrumbs
        {...rest}
        pathParts={pathParts}
        path={path}
        allowOverflow={allowOverflow}
      />
    </div>
  );
};

export default memo(BreadcrumbsPathContainer);
