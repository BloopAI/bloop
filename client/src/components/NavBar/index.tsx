import React, { memo, useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, Reorder } from 'framer-motion';
import { Bug, Card, Cog, DoorRight, Home, Magazine, Person } from '../../icons';
import { ContextMenuItem, MenuListItemType } from '../ContextMenu';
import { deleteAuthCookie } from '../../utils';
import DropdownWithIcon from '../Dropdown/WithIcon';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import { TabsContext } from '../../context/tabsContext';
import { getSubscriptionLink, gitHubLogout } from '../../services/api';
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
  const { tabs, handleReorderTabs, setActiveTab } = useContext(TabsContext);
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
              icon: <Card />,
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

  const tabsWithoutHome = useMemo(() => {
    return tabs.slice(1);
  }, [tabs]);

  return (
    <div
      className={`h-8 flex items-stretch px-8 bg-bg-base fixed top-0 left-0 right-0 z-80
       border-b border-bg-border backdrop-blur-8 select-none overflow-hidden`}
      data-tauri-drag-region
    >
      {os.type === 'Darwin' ? <span className="w-14" /> : ''}
      <button
        onClick={() => setActiveTab('initial')}
        className={`border-x px-3 border-bg-border flex items-center justify-center ${
          activeTab === 'initial'
            ? 'bg-bg-shade text-label-title'
            : 'bg-bg-base text-label-base'
        } cursor-pointer`}
      >
        <Home sizeClassName="w-4 h-4" />
      </button>
      <div
        className={`flex flex-1 overflow-auto fade-right`}
        data-tauri-drag-region
      >
        <Reorder.Group
          as="ul"
          axis="x"
          onReorder={handleReorderTabs}
          className="flex items-center justify-start h-full overflow-x-auto pr-8"
          values={tabsWithoutHome}
          layoutScroll
        >
          <AnimatePresence initial={false}>
            {!isSkeleton &&
              tabsWithoutHome.map((t) => (
                <Tab key={t.key} item={t} activeTab={activeTab} />
              ))}
          </AnimatePresence>
        </Reorder.Group>
      </div>
      {!isSkeleton && (
        <div className="flex items-center justify-center ml-3">
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
            appendTo={document.body}
          />
        </div>
      )}
    </div>
  );
};
export default memo(NavBar);
