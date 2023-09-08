import React, { memo, useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bug,
  CodeStudioIcon,
  Cog,
  DoorRight,
  Magazine,
  Person,
  Sparkle,
} from '../../icons';
import { ContextMenuItem, MenuListItemType } from '../ContextMenu';
import { deleteAuthCookie } from '../../utils';
import DropdownWithIcon from '../Dropdown/WithIcon';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import { TabsContext } from '../../context/tabsContext';
import { getSubscriptionLink, gitHubLogout } from '../../services/api';
import { RepoSource } from '../../types';
import { TabType } from '../../types/general';
import { PersonalQuotaContext } from '../../context/personalQuotaContext';
import LiteLoaderContainer from '../Loaders/LiteLoader';
import Tab from './Tab';

type Props = {
  isSkeleton?: boolean;
  activeTab: string;
};

const NavBar = ({ isSkeleton, activeTab }: Props) => {
  const { t } = useTranslation();
  const { setSettingsOpen } = useContext(UIContext.Settings);
  const { setBugReportModalOpen } = useContext(UIContext.BugReport);
  const { setShouldShowWelcome } = useContext(UIContext.Onboarding);
  const { setGithubConnected } = useContext(UIContext.GitHubConnected);
  const { isSubscribed } = useContext(PersonalQuotaContext.Values);
  const { openLink, isSelfServe, os, envConfig } = useContext(DeviceContext);
  const { tabs } = useContext(TabsContext);
  const [isFetchingLink, setIsFetchingLink] = useState(false);

  const handleUpgrade = useCallback(() => {
    setIsFetchingLink(true);
    getSubscriptionLink()
      .then((resp) => {
        openLink(resp.url);
      })
      .finally(() => setIsFetchingLink(false));
  }, [openLink]);

  const dropdownItems = useMemo(() => {
    return [
      {
        text: t('Settings'),
        icon: <Cog />,
        type: MenuListItemType.DEFAULT,
        onClick: () => setSettingsOpen(true),
      },
      ...(isSubscribed
        ? [
            {
              text: isFetchingLink ? (
                <LiteLoaderContainer />
              ) : (
                t('Manage subscription')
              ),
              icon: <CodeStudioIcon />,
              type: MenuListItemType.DEFAULT,
              onClick: handleUpgrade,
            },
          ]
        : []),
      {
        text: t('Documentation'),
        icon: <Magazine />,
        type: MenuListItemType.DEFAULT,
        onClick: () => openLink('https://bloop.ai/docs'),
      },
      {
        text: t('Report a bug'),
        icon: <Bug />,
        type: MenuListItemType.DEFAULT,
        onClick: () => setBugReportModalOpen(true),
      },
      {
        text: t('Sign out'),
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
    ] as ContextMenuItem[];
  }, [
    isSelfServe,
    openLink,
    gitHubLogout,
    t,
    isSubscribed,
    handleUpgrade,
    isFetchingLink,
  ]);

  return (
    <div
      className={`h-8 flex items-center px-8 bg-bg-base fixed top-0 left-0 right-0 z-80
       border-b border-bg-border backdrop-blur-8 select-none`}
      data-tauri-drag-region
    >
      {os.type === 'Darwin' ? <span className="w-14" /> : ''}
      <Tab
        tabKey="initial"
        name="Home"
        key="initial"
        source={RepoSource.LOCAL}
        activeTab={activeTab}
      />
      <div
        className={`flex-1 flex items-center justify-start h-full overflow-x-auto pb-1 -mb-1 pr-6 fade-right`}
        data-tauri-drag-region
      >
        {!isSkeleton &&
          tabs
            .slice(1)
            .map((t) => (
              <Tab
                tabKey={t.key}
                name={t.name}
                key={t.key}
                source={t.type === TabType.REPO ? t.source : undefined}
                activeTab={activeTab}
              />
            ))}
      </div>
      {!isSkeleton && (
        <div>
          <DropdownWithIcon
            items={dropdownItems}
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
export default memo(NavBar);
