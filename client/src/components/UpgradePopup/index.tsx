import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Modal from '../Modal';
import Button from '../Button';
import { CloseSign } from '../../icons';
import { DeviceContext } from '../../context/deviceContext';
import { UIContext } from '../../context/uiContext';
import { getSubscriptionLink } from '../../services/api';
import { PersonalQuotaContext } from '../../context/personalQuotaContext';
import useAnalytics from '../../hooks/useAnalytics';
import { polling } from '../../utils/requestUtils';
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
  const { setBugReportModalOpen } = useContext(UIContext.BugReport);
  const [link, setLink] = useState('');
  const { trackUpgradePopup } = useAnalytics();

  useEffect(() => {
    if (isUpgradePopupOpen) {
      trackUpgradePopup();
      getSubscriptionLink().then((resp) => {
        setLink(resp.url);
      });
    }
  }, [isUpgradePopupOpen]);

  const onClick = useCallback(() => {
    if (link) {
      openLink(link);
      setWaitingUpgradePopupOpen(true);
      setUpgradePopupOpen(false);
      let intervalId = polling(() => refetchQuota(), 2000);
      setTimeout(() => clearInterval(intervalId), 10 * 60 * 1000);
    } else {
      setBugReportModalOpen(true);
    }
  }, [openLink, link]);

  return (
    <Modal
      isVisible={isUpgradePopupOpen}
      onClose={() => setUpgradePopupOpen(false)}
      // containerClassName="max-w-[34rem] max-h-[80vh]"
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
    </Modal>
  );
};

export default UpgradePopup;
