import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useTranslation, Trans } from 'react-i18next';
import Button from '../Button';
import { DiscordLogo, Info, Magazine, PowerPlug } from '../../icons';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import { getDiscordLink, getSubscriptionLink } from '../../services/api';
import LanguageSelector from '../LanguageSelector';
import { PersonalQuotaContext } from '../../context/personalQuotaContext';
import LiteLoaderContainer from '../Loaders/LiteLoader';
import Tooltip from '../Tooltip';
import StatusItem from './StatusItem';

let intervalId: number;
const StatusBar = () => {
  const { t } = useTranslation();

  const { setBugReportModalOpen } = useContext(UIContext.BugReport);
  const { openLink, release } = useContext(DeviceContext);
  const { quota, isSubscribed, hasCheckedQuota } = useContext(
    PersonalQuotaContext.Values,
  );
  const { refetchQuota } = useContext(PersonalQuotaContext.Handlers);
  const { setWaitingUpgradePopupOpen } = useContext(UIContext.UpgradePopup);
  const [isOnline, setIsOnline] = useState(true);
  const [discordLink, setDiscordLink] = useState(
    'https://discord.com/invite/kZEgj5pyjm',
  );
  const [isFetchingLink, setIsFetchingLink] = useState(false);

  useEffect(() => {
    getDiscordLink().then(setDiscordLink);
  }, []);

  const handleUpgrade = useCallback(() => {
    setIsFetchingLink(true);
    setWaitingUpgradePopupOpen(true);
    getSubscriptionLink()
      .then((resp) => {
        if (resp.url) {
          openLink(resp.url);
          clearInterval(intervalId);
          intervalId = window.setInterval(() => refetchQuota(), 2000);
          setTimeout(() => clearInterval(intervalId), 10 * 60 * 1000);
        } else {
          setBugReportModalOpen(true);
        }
      })
      .catch(() => {
        setBugReportModalOpen(true);
      })
      .finally(() => setIsFetchingLink(false));
  }, [openLink]);

  useEffect(() => {
    clearInterval(intervalId);
  }, [isSubscribed]);

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
      <span className="flex gap-3 items-center">
        <p className="text-label-muted caption">v{release}</p>
        {!isSubscribed && hasCheckedQuota && (
          <>
            <div className="w-px h-4 bg-bg-border" />
            <Tooltip
              text={
                <div className="max-w-[13rem]">
                  {t(
                    'Your quota resets every 24 hours, upgrade for unlimited uses',
                  )}
                </div>
              }
              placement={'top'}
            >
              <div className="flex gap-1 items-center caption text-label-base">
                <Info raw sizeClassName="w-3.5 h-3.5" />
                <p className="pt-0.5">
                  {quota.allowed - quota.used}/{quota.allowed}{' '}
                  <Trans count={quota.allowed - quota.used}>uses left</Trans>
                </p>
              </div>
            </Tooltip>
            <Button size="small" onClick={handleUpgrade}>
              {isFetchingLink ? (
                <LiteLoaderContainer />
              ) : (
                <Trans>Upgrade</Trans>
              )}
            </Button>
          </>
        )}
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
export default memo(StatusBar);
