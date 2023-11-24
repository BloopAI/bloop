import React, { ReactNode } from 'react';
import { GitHubLogo } from '../../../../icons';
import TextField from '../../../../components/TextField';
import useAppNavigation from '../../../hooks/useAppNavigation';

type Props = {
  repoName: string;
  children: ReactNode;
};

const NavigationPanel = ({ repoName, children }: Props) => {
  const { navigateRepoPath } = useAppNavigation();
  return (
    <div className="relative flex flex-1 flex-col w-full overflow-auto bg-bg-base select-none">
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
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
};

export default NavigationPanel;
