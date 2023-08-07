import React from 'react';
import { Trans } from 'react-i18next';
import FileIcon from '../../components/FileIcon';
import BreadcrumbsPath from '../../components/BreadcrumbsPath';
import FileMenu from '../../components/FileMenu';
import { Sparkles } from '../../icons';
import Button from '../../components/Button';

type Props = {
  relativePath: string;
  repoName: string;
  repoPath: string;
  onResultClosed: () => void;
  handleExplain: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
};

const Subheader = ({
  relativePath,
  repoName,
  repoPath,
  onResultClosed,
  handleExplain,
}: Props) => {
  return (
    <div className={`w-full border-b border-bg-border p-3`}>
      <div className="flex items-center gap-2 max-w-full select-none justify-between">
        <div className="flex items-center gap-1 max-w-[calc(100%-40px)]">
          <FileIcon filename={relativePath?.slice(-5)} />
          <div className="max-w-[calc(100%-20px)]">
            <BreadcrumbsPath
              repo={repoName}
              path={relativePath}
              activeStyle="secondary"
              onClick={onResultClosed}
            />
          </div>
        </div>
        <Button size="tiny" onClick={handleExplain}>
          <Sparkles raw sizeClassName="w-3.5 h-3.5" />
          <Trans>Explain</Trans>
        </Button>
        <FileMenu relativePath={relativePath} repoPath={repoPath} />
      </div>
    </div>
  );
};

export default Subheader;
