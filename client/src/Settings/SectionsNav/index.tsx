import React, { memo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CogIcon } from '../../icons';
import { SettingSections } from '../../old_stuff/components/Settings';
import SectionButton from './SectionButton';

type Props = {};

const SectionsNav = ({}: Props) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 flex-1">
      <div className="flex items-center gap-2 h-9 text-label-muted w-56">
        <CogIcon sizeClassName="w-4 h-4" />
        <p className="body-s-b">
          <Trans>Account settings</Trans>
        </p>
      </div>
      <SectionButton type={SettingSections.GENERAL} label={t('General')} />
      <SectionButton
        type={SettingSections.PREFERENCES}
        label={t('Preferences')}
      />
      <SectionButton
        type={SettingSections.SUBSCRIPTION}
        label={t('Subscription')}
      />
    </div>
  );
};

export default memo(SectionsNav);
