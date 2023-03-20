import { useContext, useEffect, useState } from 'react';
import Button from '../Button';
import { DiscordLogo, PowerPlug, Thunder } from '../../icons';
import { SearchContext } from '../../context/searchContext';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import { getDiscordLink } from '../../services/api';
import StatusItem from './StatusItem';

const StatusBar = () => {
  const { lastQueryTime } = useContext(SearchContext);
  const { setBugReportModalOpen } = useContext(UIContext);
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
      className={`h-16 flex items-center justify-between gap-8 px-8 bg-gray-900 select-none
    text-xs border-t border-gray-800 fixed bottom-0 left-0 right-0 z-30 select-none cursor-default`}
    >
      <span className="flex text-gray-500 gap-4">
        <StatusItem
          icon={<PowerPlug />}
          textMain={'Status'}
          textSecondary={isOnline ? 'Online' : 'Offline'}
          secondaryColor={isOnline ? 'ok' : 'error'}
        />
        {/*<StatusItem*/}
        {/*  icon={<Persons />}*/}
        {/*  textMain={'Clients'}*/}
        {/*  textSecondary={'80k'}*/}
        {/*/>*/}
        <StatusItem
          icon={<Thunder />}
          textMain={'Speed of last query'}
          textSecondary={lastQueryTime + 'ms'}
        />
      </span>
      <span className="flex gap-3">
        <Button
          size="small"
          variant="secondary"
          onClick={() => openLink(discordLink)}
        >
          <DiscordLogo />
          Discord
        </Button>
        <Button
          size="small"
          variant="secondary"
          onClick={() => setBugReportModalOpen(true)}
        >
          Report a bug
        </Button>
      </span>
    </div>
  );
};
export default StatusBar;
