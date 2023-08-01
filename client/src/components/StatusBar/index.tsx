import React, { useContext, useEffect, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import Button from '../Button';
import { DiscordLogo, Globe, Magazine, Papers, PowerPlug } from '../../icons';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import { getDiscordLink } from '../../services/api';
import { MenuListItemType } from '../ContextMenu';
import DropdownWithIcon from '../Dropdown/WithIcon';
import { LocaleContext } from '../../context/localeContext';
import LanguageSelector from '../LanguageSelector';
import StatusItem from './StatusItem';

const StatusBar = () => {
  const { t } = useTranslation();

  const { setBugReportModalOpen } = useContext(UIContext.BugReport);
  const { openLink } = useContext(DeviceContext);
  const [isOnline, setIsOnline] = useState(true);
  const [discordLink, setDiscordLink] = useState(
    'https://discord.com/invite/kZEgj5pyjm',
  );

  useEffect(() => {
    getDiscordLink().then(setDiscordLink);
  }, []);

  useEffect(() => {
    const setOffline = () => {
      setIsOnline(false);
    };
    const setOnline = () => {
      setIsOnline(true);
    };
    window.addEventListener('offline', setOffline);

    window.addEventListener('online', setOnline);

    return () => {
      window.removeEventListener('offline', setOffline);
      window.removeEventListener('online', setOnline);
    };
  }, []);

  return (
    <div
      className={`h-16 flex items-center justify-between gap-8 px-8 bg-bg-base select-none
    text-xs border-t border-bg-border fixed bottom-0 left-0 right-0 z-30 cursor-default`}
    >
      <span className="flex text-label-muted gap-4">
        <LanguageSelector />
        <StatusItem
          icon={<PowerPlug />}
          textMain={t(`Status`)}
          textSecondary={isOnline ? t(`Online`) : t(`Offline`)}
          secondaryColor={isOnline ? 'ok' : 'error'}
        />
        {/*<StatusItem*/}
        {/*  icon={<Persons />}*/}
        {/*  textMain={'Clients'}*/}
        {/*  textSecondary={'80k'}*/}
        {/*/>*/}
      </span>
      <span className="flex gap-3">
        <Button
          size="small"
          variant="secondary"
          onClick={() => openLink('https://bloop.ai/docs/')}
        >
          <Magazine />
          <Trans>Documentation</Trans>
        </Button>
        <Button
          size="small"
          variant="secondary"
          onClick={() => openLink(discordLink)}
        >
          <DiscordLogo />
          <Trans>Discord</Trans>
        </Button>
        <Button
          size="small"
          variant="secondary"
          onClick={() => setBugReportModalOpen(true)}
        >
          <Trans>Report a bug</Trans>
        </Button>
      </span>
    </div>
  );
};
export default StatusBar;
