import React, { ReactNode } from 'react';
import Button from '../../Button';
import { ArrowLeft, GitHubLogo } from '../../../icons';
import TextField from '../../TextField';

type Props = {
  repoName: string;
  children: ReactNode;
  onBackNavigate?: () => void;
};

const NavigationPanel = ({ repoName, children, onBackNavigate }: Props) => {
  return (
    <div className="flex divide-y divide-gray-800 flex-col border-r border-gray-800 w-90 h-full select-none">
      <span className="flex items-center gap-3 text-gray-300 py-6 px-8 bg-gray-900">
        <Button
          size={'small'}
          variant={'tertiary'}
          className="bg-gray-900"
          onlyIcon
          onClick={onBackNavigate}
          title="Go back"
        >
          <ArrowLeft />
        </Button>
        <TextField value={repoName} icon={<GitHubLogo />} />
      </span>
      <span className="flex flex-col gap-3">{children}</span>
    </div>
  );
};

export default NavigationPanel;
