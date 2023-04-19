import React, { useContext } from 'react';
import { Bug, CloseSign, Cog, DoorRight, Magazine, Person } from '../../icons';
import { MenuListItemType } from '../ContextMenu';
import { deleteAuthCookie } from '../../utils';
import DropdownWithIcon from '../Dropdown/WithIcon';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import { TabsContext } from '../../context/tabsContext';

type Props = {
  userSigned?: boolean;
  isSkeleton?: boolean;
};

const NavBar = ({ isSkeleton }: Props) => {
  const {
    setSettingsOpen,
    setBugReportModalOpen,
    setShouldShowWelcome,
    setGithubConnected,
  } = useContext(UIContext);
  const { openLink, isSelfServe } = useContext(DeviceContext);
  const { tabs, setActiveTab, activeTab, handleRemoveTab } =
    useContext(TabsContext);

  return (
    <div
      className={`h-12 flex items-center gap-6 px-8 bg-gray-800/75 fixed top-0 left-0 right-0 z-30 justify-between
       border-b border-gray-700 backdrop-blur-8`}
    >
      <div className="flex items-center justify-start h-full overflow-auto">
        {tabs.map((t) => (
          <div
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 border-x border-gray-700 h-full flex items-center justify-center gap-4 ${
              activeTab === t.key ? 'bg-gray-700' : 'bg-gray-800'
            } cursor-pointer`}
          >
            {t.name}
            {t.key !== 'initial' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTab(t.key);
                }}
              >
                <CloseSign sizeClassName="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
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
            ...(isSelfServe
              ? [
                  {
                    text: 'Sign out',
                    icon: <DoorRight />,
                    type: MenuListItemType.DEFAULT,
                    onClick: () => {
                      setShouldShowWelcome(true);
                      deleteAuthCookie();
                      setGithubConnected(false);
                    },
                  },
                ]
              : []),
          ]}
          icon={<Person />}
          dropdownBtnClassName="-mr-4"
        />
      </div>
    </div>
  );
};
export default NavBar;
