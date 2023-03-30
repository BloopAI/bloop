import React from 'react';
import FileIcon from '../../components/FileIcon';
import BreadcrumbsPath from '../../components/BreadcrumbsPath';
import FileMenu from '../../components/FileMenu';

type Props = {
  relativePath: string;
  repoName: string;
  repoPath: string;
  onResultClosed: () => void;
};

const Subheader = ({
  relativePath,
  repoName,
  repoPath,
  onResultClosed,
}: Props) => {
  return (
    <div className={`w-full border-b border-gray-700 p-3`}>
      <div className="flex items-center gap-2 max-w-full select-none justify-between">
        <div className="flex items-center gap-1 max-w-[calc(100%-40px)]">
          <FileIcon filename={relativePath.slice(-5)} />
          <div className="max-w-[calc(100%-20px)]">
            <BreadcrumbsPath
              repo={repoName}
              path={relativePath}
              activeStyle="secondary"
              onClick={onResultClosed}
            />
          </div>
        </div>
        <FileMenu relativePath={relativePath} repoPath={repoPath} />
      </div>
    </div>
  );
};

export default Subheader;
