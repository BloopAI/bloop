import React, { ReactNode } from 'react';
import { GitHubLogo } from '../../../icons';
import TextField from '../../TextField';
import useAppNavigation from '../../../hooks/useAppNavigation';
import useResizeableWidth from '../../../hooks/useResizeableWidth';
import { LEFT_SIDEBAR_WIDTH_KEY } from '../../../services/storage';

type Props = {
  repoName: string;
  children: ReactNode;
};

const NavigationPanel = ({ repoName, children }: Props) => {
  const { navigateRepoPath } = useAppNavigation();
  const { width, handleResize, handleReset } = useResizeableWidth(
    LEFT_SIDEBAR_WIDTH_KEY,
    360,
    false,
  );
  return (
    <div className="min-h-full relative" style={{ width }}>
      <div className="flex divide-y divide-bg-border bg-bg-base flex-col border-r border-bg-border h-full select-none overflow-auto">
        <div
          className="w-full border-b border-bg-border flex justify-between py-7 px-8 select-none cursor-pointer"
          onClick={() => navigateRepoPath(repoName)}
        >
          <TextField
            value={repoName}
            icon={<GitHubLogo />}
            className={'ellipsis'}
          />
        </div>
        <div className="flex-1 overflow-auto flex flex-col h-full">
          {children}
        </div>
      </div>
      <div
        className="absolute top-0 bottom-0 right-0 w-2 border-r border-bg-border hover:border-bg-main cursor-col-resize"
        onMouseDown={handleResize}
        onDoubleClick={handleReset}
      />
    </div>
  );
};

export default NavigationPanel;
