import React, { ReactNode } from 'react';
import { GitHubLogo } from '../../../icons';
import TextField from '../../TextField';

type Props = {
  repoName: string;
  children: ReactNode;
};

const NavigationPanel = ({ repoName, children }: Props) => {
  return (
    <div className="flex divide-y divide-gray-800 flex-col border-r border-gray-800 w-90 h-full select-none">
      <span className="flex items-center gap-3 text-gray-300 py-6 px-8 bg-gray-900">
        <TextField value={repoName} icon={<GitHubLogo />} />
      </span>
      <span className="flex flex-col gap-3">{children}</span>
    </div>
  );
};

export default NavigationPanel;
