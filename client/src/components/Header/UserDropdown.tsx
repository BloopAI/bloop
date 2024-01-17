import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import SectionItem from '../Dropdown/Section/SectionItem';
import {
  BugIcon,
  CogIcon,
  DocumentsIcon,
  DoorOutIcon,
  WalletIcon,
} from '../../icons';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import { useSignOut } from '../../hooks/useSignOut';
import { getDiscordLink } from '../../services/api';
import { SettingSections } from '../../types/general';

type Props = {};

const UserDropdown = ({}: Props) => {
  const { t } = useTranslation();
  const [discordLink, setDiscordLink] = useState(
    'https://discord.com/invite/kZEgj5pyjm',
  );
  const { setBugReportModalOpen } = useContext(UIContext.BugReport);
  const { openLink } = useContext(DeviceContext);
  const { setSettingsOpen, setSettingsSection } = useContext(
    UIContext.Settings,
  );
  const { setProjectSettingsOpen } = useContext(UIContext.ProjectSettings);
  const handleSignOut = useSignOut();

  useEffect(() => {
    getDiscordLink().then(setDiscordLink);
  }, []);

  const openGeneralSettings = useCallback(() => {
    setSettingsSection(SettingSections.GENERAL);
    setProjectSettingsOpen(false);
    setSettingsOpen(true);
  }, []);

  const openSubscriptionSettings = useCallback(() => {
    setSettingsSection(SettingSections.SUBSCRIPTION);
    setSettingsOpen(true);
  }, []);

  const reportBug = useCallback(() => {
    setBugReportModalOpen(true);
  }, []);

  return (
    <div className="">
      <div className="flex flex-col p-1 items-start border-y border-bg-border">
        <SectionItem
          icon={<CogIcon raw sizeClassName="w-4 h-4" />}
          label={t('Settings')}
          shortcut={['option', 'A']}
          onClick={openGeneralSettings}
        />
        <SectionItem
          icon={<WalletIcon raw sizeClassName="w-4 h-4" />}
          label={t('Subscription')}
          shortcut={['option', 'S']}
          onClick={openSubscriptionSettings}
        />
        <SectionItem
          icon={<DocumentsIcon raw sizeClassName="w-4 h-4" />}
          label={t('Docs')}
          shortcut={['option', 'D']}
          onClick={() => openLink('https://bloop.ai/docs')}
        />
        <SectionItem
          icon={<BugIcon raw sizeClassName="w-4 h-4" />}
          label={t('Report a bug')}
          shortcut={['option', 'B']}
          onClick={reportBug}
        />
      </div>
      <div className="flex flex-col p-1 items-start border-b border-bg-border">
        <SectionItem
          label={t('Join Discord')}
          onClick={() => openLink(discordLink)}
        />
        <SectionItem
          label={t('Follow us on Twitter')}
          onClick={() => openLink('https://twitter.com/bloopdotai')}
        />
      </div>
      <div className="flex flex-col p-1 items-start">
        <SectionItem
          icon={<DoorOutIcon raw sizeClassName="w-4 h-4" />}
          label={t('Sign out')}
          shortcut={['option', 'shift', 'Q']}
          onClick={handleSignOut}
        />
      </div>
    </div>
  );
};

export default memo(UserDropdown);
