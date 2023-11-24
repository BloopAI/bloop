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
  onUpgrade: () => void;
  hasUpgraded: boolean;
  isFetchingLink: boolean;
};

const CardPaid = ({
  isActive,
  hasUpgraded,
  onUpgrade,
  isFetchingLink,
}: Props) => {
  const { t } = useTranslation();

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
        <Button onClick={onUpgrade}>
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
