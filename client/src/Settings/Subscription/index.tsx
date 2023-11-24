import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { PersonalQuotaContext } from '../../context/personalQuotaContext';
import { getSubscriptionLink } from '../../services/api';
import { DeviceContext } from '../../context/deviceContext';
import { UIContext } from '../../context/uiContext';
import LiteLoaderContainer from '../../components/Loaders/LiteLoader';
import { polling } from '../../utils/requestUtils';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import SpinLoaderContainer from '../../components/Loaders/SpinnerLoader';
import CardFree from './CardFree';
import CardPaid from './CardPaid';

type Props = {};

const SubscriptionSettings = ({}: Props) => {
  useTranslation();
  const [isFetchingLink, setIsFetchingLink] = useState(false);
  const [isUpgradeRequested, setIsUpgradeRequested] = useState(false);
  const { isSubscribed } = useContext(PersonalQuotaContext.Values);
  const { refetchQuota } = useContext(PersonalQuotaContext.Handlers);
  const { openLink } = useContext(DeviceContext);
  const { setBugReportModalOpen } = useContext(UIContext.BugReport);
  const [hasUpgraded, setHasUpgraded] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const intervalId = useRef(0);

  const handleUpgrade = useCallback(() => {
    setIsFetchingLink(true);
    getSubscriptionLink()
      .then((resp) => {
        if (resp.url) {
          openLink(resp.url);
          clearInterval(intervalId.current);
          if (!isSubscribed) {
            setIsUpgradeRequested(true);
            intervalId.current = polling(() => refetchQuota(), 2000);
            setTimeout(() => clearInterval(intervalId.current), 10 * 60 * 1000);
          }
        } else {
          setBugReportModalOpen(true);
        }
      })
      .catch(() => {
        setBugReportModalOpen(true);
      })
      .finally(() => setIsFetchingLink(false));
  }, [openLink, isSubscribed]);

  useEffect(() => {
    if (!hasUpgraded && isSubscribed && isUpgradeRequested) {
      clearInterval(intervalId.current);
      setHasUpgraded(true);
      setIsUpgradeRequested(false);
    }
  }, [isSubscribed, hasUpgraded, isUpgradeRequested]);

  const handleCancel = useCallback(() => {
    setIsUpgradeRequested(false);
    clearInterval(intervalId.current);
  }, []);

  const onManualOpenClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      e.preventDefault();
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

  const checkStatus = useCallback(() => {
    refetchQuota().then(() => setHasChecked(true));
  }, []);

  return (
    <div className="w-[36.25rem] flex flex-col flex-2 select-none">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-3 ">
          <p className="body-m text-label-title">
            {isUpgradeRequested ? (
              <Trans>Upgrade to Personal plan</Trans>
            ) : (
              <Trans>Plans</Trans>
            )}
          </p>
          <p className="body-s text-label-muted">
            {isUpgradeRequested ? (
              <Trans>$20 / billed monthly</Trans>
            ) : (
              <Trans>Manage your subscription plan</Trans>
            )}
          </p>
        </div>
        {isUpgradeRequested && (
          <Button onClick={handleCancel} variant="danger">
            <Trans>Cancel</Trans>
          </Button>
        )}
      </div>
      <hr className="border-bg-divider my-8" />
      {isUpgradeRequested ? (
        <div className="w-full flex flex-col gap-6 items-center">
          <SpinLoaderContainer sizeClassName="w-4.5 h-4.5 text-label-base" />
          <div className="flex flex-col gap-2 items-center">
            <p className="text-label-title body-base-b">
              <Trans>Complete your transaction in Stripe...</Trans>
            </p>
            <p className="body-s text-label-base max-w-sm text-center">
              <Trans>
                We&apos;ve redirected you to Stripe to complete your
                transaction.{' '}
                <a
                  href="#"
                  className="text-label-link cursor-pointer"
                  onClick={onManualOpenClick}
                >
                  Launch manually
                </a>{' '}
                if it didn&apos;t work.
              </Trans>
            </p>
          </div>
          {hasChecked && (
            <Badge
              size="large"
              text="No change in payment status identified."
              type="red-subtle"
            />
          )}
          <Button variant="primary" size="small" onClick={checkStatus}>
            {hasChecked ? (
              <Trans>Try again</Trans>
            ) : (
              <Trans>Re-check payment status</Trans>
            )}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex gap-5 items-center w-full">
            <CardFree
              isActive={!isSubscribed}
              onManage={handleUpgrade}
              isFetchingLink={isFetchingLink}
            />
            <CardPaid
              isActive={isSubscribed}
              onUpgrade={handleUpgrade}
              hasUpgraded={hasUpgraded}
              isFetchingLink={isFetchingLink}
            />
          </div>
          <hr className="border-bg-divider my-8" />
          <div className="flex items-center gap-2">
            <div className="p-0.5">
              <img src="/stripe_logo.png" alt="Stripe" className="w-4 h-4" />
            </div>
            <p className="body-mini text-label-muted flex-1">
              <Trans>
                All payments, invoices and billing information are managed in
                Stripe.
              </Trans>
            </p>
            {isSubscribed && (
              <button
                className="body-mini text-label-link"
                onClick={handleUpgrade}
              >
                {isFetchingLink ? (
                  <LiteLoaderContainer sizeClassName="w-4 h-4" />
                ) : (
                  <Trans>Manage</Trans>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default memo(SubscriptionSettings);
