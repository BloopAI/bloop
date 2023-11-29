import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import SectionItem from '../Dropdown/Section/SectionItem';
import {
  BugIcon,
  CogIcon,
  DocumentsIcon,
  DoorOutIcon,
  WalletIcon,
} from '../../icons';

type Props = {};

const UserDropdown = ({}: Props) => {
  const { t } = useTranslation();

  return (
    <div className="">
      <div className="flex flex-col p-1 items-start border-y border-bg-border">
        <SectionItem
          icon={<CogIcon raw sizeClassName="w-4 h-4" />}
          label={t('Settings')}
          shortcut={['option', 'A']}
          onClick={() => {}}
        />
        <SectionItem
          icon={<WalletIcon raw sizeClassName="w-4 h-4" />}
          label={t('Subscription')}
          shortcut={['option', 'S']}
          onClick={() => {}}
        />
        <SectionItem
          icon={<DocumentsIcon raw sizeClassName="w-4 h-4" />}
          label={t('Docs')}
          shortcut={['option', 'D']}
          onClick={() => {}}
        />
        <SectionItem
          icon={<BugIcon raw sizeClassName="w-4 h-4" />}
          label={t('Report a bug')}
          shortcut={['option', 'B']}
          onClick={() => {}}
        />
      </div>
      <div className="flex flex-col p-1 items-start border-b border-bg-border">
        <SectionItem label={t('Join Discord')} onClick={() => {}} />
        <SectionItem label={t('Follow us on Twitter')} onClick={() => {}} />
      </div>
      <div className="flex flex-col p-1 items-start">
        <SectionItem
          icon={<DoorOutIcon raw sizeClassName="w-4 h-4" />}
          label={t('Sign out')}
          shortcut={['option', 'shift', 'Q']}
          onClick={() => {}}
        />
      </div>
    </div>
  );
};

export default memo(UserDropdown);
