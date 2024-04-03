import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import SectionItem from '../Dropdown/Section/SectionItem';
import { CogIcon, DocumentsIcon } from '../../icons';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import { SettingSections } from '../../types/general';

type Props = {};
const discordLink = 'https://discord.com/invite/kZEgj5pyjm';

const UserDropdown = ({}: Props) => {
  const { t } = useTranslation();
  const { openLink } = useContext(DeviceContext);
  const { setSettingsOpen, setSettingsSection } = useContext(
    UIContext.Settings,
  );
  const { setProjectSettingsOpen } = useContext(UIContext.ProjectSettings);

  const openGeneralSettings = useCallback(() => {
    setSettingsSection(SettingSections.GENERAL);
    setProjectSettingsOpen(false);
    setSettingsOpen(true);
  }, []);

  return (
    <div className="">
      <div className="flex flex-col p-1 items-start border-y border-bg-border">
        <SectionItem
          icon={<CogIcon raw sizeClassName="w-4 h-4" />}
          label={t('Settings')}
          shortcut={['option', 'A']}
          index={'settings'}
          onClick={openGeneralSettings}
        />
        <SectionItem
          icon={<DocumentsIcon raw sizeClassName="w-4 h-4" />}
          label={t('Docs')}
          shortcut={['option', 'D']}
          index={'docs'}
          onClick={() => openLink('https://bloop.ai/docs')}
        />
      </div>
      <div className="flex flex-col p-1 items-start">
        <SectionItem
          label={t('Join Discord')}
          index={'discord'}
          onClick={() => openLink(discordLink)}
        />
        <SectionItem
          label={t('Follow us on Twitter')}
          index={'twitter'}
          onClick={() => openLink('https://twitter.com/bloopdotai')}
        />
      </div>
    </div>
  );
};

export default memo(UserDropdown);
