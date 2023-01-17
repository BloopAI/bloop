import React, { ReactNode } from 'react';
import { GitHubLogo } from '../../../icons';
import TextField from '../../TextField';
import useAppNavigation from '../../../hooks/useAppNavigation';

type Props = {
  repoName: string;
  children: ReactNode;
};

const NavigationPanel = ({ repoName, children }: Props) => {
  const { navigateRepoPath } = useAppNavigation();
  return (
    <div className="flex divide-y divide-gray-800 flex-col border-r border-gray-800 w-90 h-full select-none">
      <div
        className="w-full border-b border-gray-700 flex justify-between py-7 px-8 select-none cursor-pointer"
        onClick={() => navigateRepoPath(repoName)}
      >
        <TextField
          value={repoName}
          icon={<GitHubLogo />}
          className={'ellipsis'}
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

export default NavigationPanel;
