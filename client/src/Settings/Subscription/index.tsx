import React, { memo, useCallback, useContext, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { PersonalQuotaContext } from '../../context/personalQuotaContext';
import { getSubscriptionLink } from '../../services/api';
import { DeviceContext } from '../../context/deviceContext';
import { UIContext } from '../../context/uiContext';
import LiteLoaderContainer from '../../components/Loaders/LiteLoader';
import CardFree from './CardFree';
import CardPaid from './CardPaid';

type Props = {};

const SubscriptionSettings = ({}: Props) => {
  useTranslation();
  const [isFetchingLink, setIsFetchingLink] = useState(false);
  const { isSubscribed } = useContext(PersonalQuotaContext.Values);
  const { openLink } = useContext(DeviceContext);
  const { setBugReportModalOpen } = useContext(UIContext.BugReport);

  const handleManage = useCallback(() => {
    setIsFetchingLink(true);
    getSubscriptionLink()
      .then((resp) => {
        if (resp.url) {
          openLink(resp.url);
        } else {
          setBugReportModalOpen(true);
        }
      })
      .catch((err) => {
        console.log(err);
        setBugReportModalOpen(true);
      })
      .finally(() => setIsFetchingLink(false));
  }, [openLink]);

  return (
    <div className="w-[36.25rem] flex flex-col flex-2">
      <div className="flex flex-col gap-3 ">
        <p className="body-m text-label-title">
          <Trans>Plans</Trans>
        </p>
        <p className="body-s text-label-muted">
          <Trans>Manage your subscription plan</Trans>
        </p>
      </div>
      <hr className="border-bg-divider my-8" />
      <div className="flex gap-5 items-center w-full">
        <CardFree isActive={!isSubscribed} onManage={handleManage} />
        <CardPaid isActive={isSubscribed} />
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
          <button className="body-mini text-label-link" onClick={handleManage}>
            {isFetchingLink ? (
              <LiteLoaderContainer sizeClassName="w-4 h-4" />
            ) : (
              <Trans>Manage</Trans>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default memo(SubscriptionSettings);
