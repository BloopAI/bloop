import React, { useContext } from 'react';
import { Bug, Cog, DoorRight, Magazine, Person } from '../../icons';
import { MenuListItemType } from '../ContextMenu';
import { deleteAuthCookie } from '../../utils';
import DropdownWithIcon from '../Dropdown/WithIcon';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import { TabsContext } from '../../context/tabsContext';
import { gitHubLogout } from '../../services/api';
import { RepoSource } from '../../types';
import Tab from './Tab';

type Props = {
  isSkeleton?: boolean;
};

const NavBar = ({ isSkeleton }: Props) => {
  const {
    setBugReportModalOpen,
    setShouldShowWelcome,
    setGithubConnected,
    setSettingsOpen,
  } = useContext(UIContext);
  const { openLink, isSelfServe, os, envConfig } = useContext(DeviceContext);
  const { tabs, setActiveTab, activeTab, handleRemoveTab } =
    useContext(TabsContext);

  return (
    <div
      className={`h-8 flex items-center px-8 bg-bg-base fixed top-0 left-0 right-0 z-50
       border-b border-bg-border backdrop-blur-8 select-none`}
      data-tauri-drag-region
    >
      {os.type === 'Darwin' ? <span className="w-14" /> : ''}
      <Tab
        tabKey="initial"
        name="Home"
        key="initial"
        source={RepoSource.LOCAL}
      />
      <div
        className={`flex-1 flex items-center justify-start h-full overflow-x-auto pb-1 -mb-1 pr-6 fade-right`}
        data-tauri-drag-region
      >
        {!isSkeleton &&
          tabs
            .slice(1)
            .map((t) => (
              <Tab tabKey={t.key} name={t.name} key={t.key} source={t.source} />
            ))}
      </div>
      {!isSkeleton && (
        <div>
          <DropdownWithIcon
            items={[
              {
                text: 'Settings',
                icon: <Cog />,
                type: MenuListItemType.DEFAULT,
                onClick: () => setSettingsOpen(true),
              },
              {
                text: 'Documentation',
                icon: <Magazine />,
                type: MenuListItemType.DEFAULT,
                onClick: () => openLink('https://bloop.ai/docs'),
              },
              {
                text: 'Report a bug',
                icon: <Bug />,
                type: MenuListItemType.DEFAULT,
                onClick: () => setBugReportModalOpen(true),
              },
              {
                text: 'Sign out',
                icon: <DoorRight />,
                type: MenuListItemType.DEFAULT,
                onClick: () => {
                  setShouldShowWelcome(true);
                  deleteAuthCookie();
                  setGithubConnected(false);
                  if (!isSelfServe) {
                    gitHubLogout();
                  }
                },
              },
            ]}
            icon={
              envConfig.github_user?.avatar_url ? (
                <div className="w-5 h-5 rounded-full overflow-hidden">
                  <img src={envConfig.github_user?.avatar_url} alt="avatar" />
                </div>
              ) : (
                <Person />
              )
            }
            dropdownBtnClassName="-mr-4"
            btnSize="tiny"
            btnVariant="tertiary"
          />
        </div>
      )}
    </div>
  );
};
export default NavBar;
