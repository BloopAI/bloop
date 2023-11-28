import React, { memo, useContext } from 'react';
import { ChevronDownIcon, KLetterIcon, PersonIcon } from '../../icons';
import { DeviceContext } from '../../context/deviceContext';
import Button from '../Button';
import Dropdown from '../Dropdown';
import { EnvContext } from '../../context/envContext';
import UserDropdown from './UserDropdown';
import ProjectsDropdown from './ProjectsDropdown';

type Props = {
  isSkeleton?: boolean;
};

const Header = ({ isSkeleton }: Props) => {
  const { os } = useContext(DeviceContext);
  const { envConfig } = useContext(EnvContext);

  return (
    <div
      className="w-screen h-10 flex items-center justify-between border-b border-bg-border bg-bg-base"
      data-tauri-drag-region
    >
      <div className="flex h-full">
        {os.type === 'Darwin' && window.innerHeight !== screen.height ? (
          <span className="w-16" />
        ) : (
          ''
        )}
        <Dropdown
          dropdownItems={<ProjectsDropdown />}
          dropdownPlacement="bottom-end"
        >
          <div className="flex w-72 px-4 items-center text-left h-10 gap-4 border-r border-bg-border hover:bg-bg-base-hover">
            <p className="flex-1 body-s">Default project</p>
            <ChevronDownIcon raw sizeClassName="w-3.5 h-3.5" />
          </div>
        </Dropdown>
      </div>
      <div className="flex pl-2 pr-4 items-center gap-2 h-full">
        <Button variant="tertiary" size="mini">
          <KLetterIcon
            sizeClassName="w-3.5 h-3.5"
            className="-translate-y-px"
          />
          Commands
        </Button>
        <Dropdown
          dropdownItems={<UserDropdown />}
          dropdownPlacement="bottom-end"
        >
          {envConfig.github_user?.avatar_url ? (
            <div className="w-5 h-5 rounded-full overflow-hidden">
              <img src={envConfig.github_user?.avatar_url} alt="avatar" />
            </div>
          ) : (
            <PersonIcon />
          )}
        </Dropdown>
      </div>
    </div>
  );
};

export default memo(Header);
