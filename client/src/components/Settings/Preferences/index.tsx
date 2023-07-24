import React, { useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import SettingsText from '../SettingsText';
import SettingsRow from '../SettingsRow';
import { UIContext } from '../../../context/uiContext';
import Dropdown from '../../Dropdown/Normal';
import { MenuItemType } from '../../../types/general';
import { Theme } from '../../../types';
import { previewTheme } from '../../../utils';

export const themesMap = {
  system: 'System Preference',
  default: 'Default',
  'vsc-default-dark': 'VSCode Dark',
  abyss: 'Abyss',
  'atom-one-dark-pro': 'Atom One Dark Pro',
  darcula: 'Darcula',
  dracula: 'Dracula',
  'github-dark': 'GitHub Dark',
  'gruvbox-dark': 'Gruvbox Dark',
  'kimbie-dark': 'Kimbie',
  material: 'Material',
  monokai: 'Monokai',
  'night-owl': 'Night Owl',
  'solarized-dark': 'Solarized Dark',
  'tomorrow-night-blue': 'Tomorrow Night Blue',
  'default-light': 'Default Light',
  'vsc-default-light': 'VSCode Light',
  'github-light': 'GitHub Light',
  'gruvbox-light': 'Gruvbox Light',
  'quiet-light': 'Quiet Light',
  'solarized-light': 'Solarized Light',
};

const Preferences = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useContext(UIContext);

  return (
    <div className="w-full relative">
      <div className="mb-6">
        <h5>
          <Trans>Preferences</Trans>
        </h5>
      </div>
      <div>
        <SettingsRow>
          <SettingsText
            title={t('Theme')}
            subtitle={t('Select your interface color scheme')}
          />
          <Dropdown
            items={Object.entries(themesMap).map(([key, name]) => ({
              type: MenuItemType.DEFAULT,
              text: t(name),
              onClick: () => setTheme(key as Theme),
              onMouseOver: () => previewTheme(key),
            }))}
            onClose={() => previewTheme(theme)}
            selected={{
              type: MenuItemType.DEFAULT,
              text: t(themesMap[theme]),
            }}
          />
        </SettingsRow>
      </div>
    </div>
  );
};

export default Preferences;
