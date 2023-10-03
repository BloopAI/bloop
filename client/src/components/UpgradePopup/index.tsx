import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import ModalOrSidebar from '../ModalOrSidebar';
import Button from '../Button';
import { CloseSign } from '../../icons';
import { DeviceContext } from '../../context/deviceContext';
import { UIContext } from '../../context/uiContext';
import { getSubscriptionLink } from '../../services/api';
import { PersonalQuotaContext } from '../../context/personalQuotaContext';
import Countdown from './Countdown';
import ConversationSvg from './ConversationSvg';

const UpgradePopup = () => {
  const { t } = useTranslation();
  const { openLink } = useContext(DeviceContext);
  const { refetchQuota } = useContext(PersonalQuotaContext.Handlers);
  const {
    isUpgradePopupOpen,
    setUpgradePopupOpen,
    setWaitingUpgradePopupOpen,
  } = useContext(UIContext.UpgradePopup);
  const [link, setLink] = useState('');

  useEffect(() => {
    if (isUpgradePopupOpen) {
      getSubscriptionLink().then((resp) => {
        setLink(resp.url);
      });
    }
  }, [isUpgradePopupOpen]);

  const onClick = useCallback(() => {
    openLink(link);
    setWaitingUpgradePopupOpen(true);
    setUpgradePopupOpen(false);
    let intervalId = window.setInterval(() => refetchQuota(), 2000);
    setTimeout(() => clearInterval(intervalId), 10 * 60 * 1000);
  }, [openLink]);

  return (
    <ModalOrSidebar
      isSidebar={false}
      shouldShow={isUpgradePopupOpen}
      onClose={() => setUpgradePopupOpen(false)}
      isModalSidebarTransition={false}
      setIsModalSidebarTransition={() => {}}
      shouldStretch={false}
      fullOverlay
      containerClassName="max-w-[34rem] max-h-[80vh]"
    >
      <div className="relative bg-bg-shade overflow-auto">
        <div>
          <ConversationSvg />
        </div>
        <div className="py-8 px-6 flex flex-col gap-8 items-center">
          <div className="flex flex-col gap-3 text-center">
            <h4 className="h4 text-label-title">
              <Trans>Usage resets in</Trans> <Countdown />
            </h4>
            <p className="body-s text-label-base">
              <Trans>
                You&apos;ve run out of free usage for today, please wait for
                your quota to reset or upgrade for unlimited usage
              </Trans>
            </p>
          </div>
          <Button onClick={onClick}>
            <Trans>Upgrade</Trans>
          </Button>
        </div>
        <div className="absolute top-2 right-2">
          <Button
            onlyIcon
            title={t('Close')}
            variant="tertiary"
            size="small"
            onClick={() => setUpgradePopupOpen(false)}
          >
            <CloseSign />
          </Button>
        </div>
      </div>
    </ModalOrSidebar>
  );
};

export default UpgradePopup;
