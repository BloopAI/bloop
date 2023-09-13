import React, { ReactNode } from 'react';
import { GitHubLogo } from '../../../icons';
import TextField from '../../TextField';
import useAppNavigation from '../../../hooks/useAppNavigation';
import useResizeableWidth from '../../../hooks/useResizeableWidth';
import {
  LEFT_SIDEBAR_WIDTH_KEY,
  RIGHT_SIDEBAR_WIDTH_KEY,
} from '../../../services/storage';

type Props = {
  repoName: string;
  children: ReactNode;
};

const NavigationPanel = ({ repoName, children }: Props) => {
  const { navigateRepoPath } = useAppNavigation();
  return (
    <div className="min-h-full relative flex w-full">
      <div className="flex flex-1 bg-bg-base flex-col border-r border-bg-border min-h-full select-none overflow-auto">
        <div
          className="w-full border-b border-bg-border flex justify-between h-12 flex-shrink-0 px-6 select-none cursor-pointer"
          onClick={() => navigateRepoPath(repoName)}
        >
          <TextField
            value={repoName.replace(/^github\.com\//, '')}
            icon={<GitHubLogo />}
            className={'ellipsis subhead-s'}
          />
        </div>
        <div className="flex-1 overflow-auto flex flex-col min-h-full">
          {children}
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
