import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import { getSubscriptionLink } from '../../services/api';
import { polling } from '../../utils/requestUtils';
import { DeviceContext } from '../../context/deviceContext';
import { UIContext } from '../../context/uiContext';
import { PersonalQuotaContext } from '../../context/personalQuotaContext';
import LiteLoaderContainer from '../../components/Loaders/LiteLoader';
import BenefitItem from './BenefitItem';
import Confetti from './Confetti';

type Props = {
  isActive: boolean;
};

const CardPaid = ({ isActive }: Props) => {
  const { t } = useTranslation();
  const { refetchQuota } = useContext(PersonalQuotaContext.Handlers);
  const { openLink } = useContext(DeviceContext);
  const { setBugReportModalOpen } = useContext(UIContext.BugReport);
  const [isFetchingLink, setIsFetchingLink] = useState(false);
  const [isLinkRequested, setIsLinkRequested] = useState(false);
  const intervalId = useRef(0);
  const [hasUpgraded, setHasUpgraded] = useState(false);

  const handleUpgrade = useCallback(() => {
    setIsFetchingLink(true);
    getSubscriptionLink()
      .then((resp) => {
        if (resp.url) {
          setIsLinkRequested(true);
          openLink(resp.url);
          clearInterval(intervalId.current);
          intervalId.current = polling(() => refetchQuota(), 2000);
          setTimeout(() => clearInterval(intervalId.current), 10 * 60 * 1000);
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
    if (!hasUpgraded && isActive && isLinkRequested) {
      clearInterval(intervalId.current);
      setHasUpgraded(true);
    }
  }, [isActive, hasUpgraded, isLinkRequested]);

  return (
    <div className="flex flex-col gap-8 p-5 flex-1 overflow-hidden rounded-2xl border border-bg-border bg-bg-base shadow-high relative">
      {hasUpgraded && <Confetti />}
      <div className="flex flex-col gap-2">
        <p className="body-s text-[#FF6439]">
          <Trans>Personal</Trans>
        </p>
        <p className="headline-b text-label-title">
          $20{' '}
          <span className="text-label-muted title-s">
            / <Trans>billed monthly</Trans>
          </span>
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <BenefitItem text={t('Desktop app')} />
        <BenefitItem text={t('Natural language search')} />
        <BenefitItem text={t('Precise code navigation')} />
        <BenefitItem text={t('Sync local git repos')} />
        <BenefitItem text={t('Latest model updates')} />
        <BenefitItem text={t('Unlimited code studio requests')} />
        <BenefitItem text={t('Index multiple branches')} />
      </div>
      {isActive ? (
        <div>
          <Badge text={t(`Currently active`)} type="green-subtle" />
        </div>
      ) : (
        <Button onClick={handleUpgrade}>
          {isFetchingLink ? (
            <LiteLoaderContainer sizeClassName="w-4 h-4" />
          ) : (
            <Trans>Upgrade</Trans>
          )}
        </Button>
      )}
    </div>
  );
};

export default memo(CardPaid);
