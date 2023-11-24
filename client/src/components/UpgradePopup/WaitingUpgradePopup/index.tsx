import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { UIContext } from '../../../context/uiContext';
import Modal from '../../Modal';
import Button from '../../Button';
import { CloseSign } from '../../../icons';
import LiteLoaderContainer from '../../Loaders/LiteLoader';
import { getSubscriptionLink } from '../../../services/api';
import { DeviceContext } from '../../../context/deviceContext';
import { PersonalQuotaContext } from '../../../context/personalQuotaContext';

type Props = {};

const WaitingUpgradePopup = ({}: Props) => {
  const { t } = useTranslation();
  const { isWaitingUpgradePopupOpen, setWaitingUpgradePopupOpen } = useContext(
    UIContext.UpgradePopup,
  );
  const { openLink } = useContext(DeviceContext);
  const { refetchQuota } = useContext(PersonalQuotaContext.Handlers);
  const { isSubscribed } = useContext(PersonalQuotaContext.Values);
  const { setBugReportModalOpen } = useContext(UIContext.BugReport);
  const [hasChecked, setHasChecked] = useState(false);

  const onManualOpenClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      e.preventDefault();
      setWaitingUpgradePopupOpen(true);
      getSubscriptionLink()
        .then((resp) => {
          if (resp.url) {
            openLink(resp.url);
          } else {
            setBugReportModalOpen(true);
          }
        })
        .catch(() => {
          setBugReportModalOpen(true);
        });
    },
    [openLink],
  );

  useEffect(() => {
    if (!isWaitingUpgradePopupOpen) {
      setHasChecked(false);
    }
  }, [isWaitingUpgradePopupOpen]);

  const checkStatus = useCallback(() => {
    refetchQuota().then(() => setHasChecked(true));
  }, []);

  return (
    <Modal
      isVisible={isWaitingUpgradePopupOpen}
      onClose={() => setWaitingUpgradePopupOpen(false)}
      noWrapper
    >
      <div className="relative rounded-lg border border-bg-border shadow-float bg-bg-shade overflow-auto w-[34rem]">
        {hasChecked && isSubscribed ? (
          <>
            <div className="bg-bg-base w-full h-[11.25rem]">
              <img
                src="/upgradeIllustration.png"
                className="w-full h-full"
                alt="celebration"
              />
            </div>
            <div className="flex flex-col items-center gap-8 px-6 py-8 text-label-title">
              <div className="flex flex-col gap-3 items-center text-center">
                <h4 className="h4 text-label-title">
                  <Trans>You&apos;ve upgraded your account!</Trans>
                </h4>
                <p className="body-s text-label-base">
                  <Trans>
                    Unlimited usage and premium features are activated.
                  </Trans>
                </p>
              </div>
              <Button onClick={() => setWaitingUpgradePopupOpen(false)}>
                <Trans>Let&apos;s go</Trans>
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-8 px-6 py-8 text-label-title">
            <LiteLoaderContainer sizeClassName="w-8 h-8" />
            <div className="flex flex-col gap-3 items-center text-center">
              <h4 className="h4 text-label-title">
                <Trans>Complete your transaction in Stripe...</Trans>
              </h4>
              <p className="body-s text-label-base mx-10">
                <Trans>
                  We&apos;ve redirected you to Stripe to complete your
                  transaction. Didn&apos;t work?
                </Trans>{' '}
                <a
                  href="#"
                  className="text-label-link cursor-pointer"
                  onClick={onManualOpenClick}
                >
                  <Trans>Launch manually</Trans>
                </a>
              </p>
            </div>
            {hasChecked && !isSubscribed && (
              <p className={'body-s text-bg-danger'}>
                <Trans>No change in payment status identified.</Trans>
              </p>
            )}
            <Button variant="secondary" onClick={checkStatus}>
              <Trans>Check payment status</Trans>
            </Button>
          </div>
        )}
        <div className="absolute top-2 right-2">
          <Button
            variant="tertiary"
            size="small"
            onClick={() => setWaitingUpgradePopupOpen(false)}
            onlyIcon
            title={t('Close')}
          >
            <CloseSign />
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(WaitingUpgradePopup);
