import React, { memo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import LiteLoaderContainer from '../../components/Loaders/LiteLoader';
import BenefitItem from './BenefitItem';

type Props = {
  isActive: boolean;
  isFetchingLink: boolean;
  onManage: () => void;
};

const CardFree = ({ isActive, onManage, isFetchingLink }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="w-56 flex flex-col pt-5 gap-8 flex-shrink-0">
      <div className="flex flex-col gap-2">
        <p className="body-s text-[#AD8AFF]">
          <Trans>Individual</Trans>
        </p>
        <p className="headline-b text-label-title">
          <Trans>Free</Trans>
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <BenefitItem text={t('Desktop app')} />
        <BenefitItem text={t('Natural language search')} />
        <BenefitItem text={t('Precise code navigation')} />
        <BenefitItem text={t('Sync local git repos')} />
        <BenefitItem text={t('Latest model updates')} />
      </div>
      {isActive ? (
        <div>
          <Badge text={t(`Currently active`)} type="green-subtle" />
        </div>
      ) : (
        <Button onClick={onManage} variant="secondary">
          {isFetchingLink ? (
            <LiteLoaderContainer sizeClassName="w-4 h-4" />
          ) : (
            <Trans>Downgrade</Trans>
          )}
        </Button>
      )}
    </div>
  );
};

export default memo(CardFree);
