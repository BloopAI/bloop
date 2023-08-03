import React, { useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import SettingsText from '../SettingsText';
import SettingsRow from '../SettingsRow';
import { UIContext } from '../../../context/uiContext';
import Dropdown from '../../Dropdown/Normal';
import { MenuItemType } from '../../../types/general';
import { Theme } from '../../../types';
import { previewTheme } from '../../../utils';
import { ChatContext } from '../../../context/chatContext';
import { Run, Walk } from '../../../icons';

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
  const { theme, setTheme } = useContext(UIContext.Theme);
  const { preferredAnswerSpeed, setPreferredAnswerSpeed } = useContext(
    UIContext.AnswerSpeed,
  );

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
        <SettingsRow>
          <SettingsText
            title={t('Answer speed')}
            subtitle={t('Faster answers may impact the quality of results')}
          />
          <Dropdown
            items={[
              {
                type: MenuItemType.DEFAULT,
                text: t('Fast'),
                onClick: () => setPreferredAnswerSpeed('fast'),
                icon: <Run />,
              },
              {
                type: MenuItemType.DEFAULT,
                text: t('Normal'),
                onClick: () => {
                  setPreferredAnswerSpeed('normal');
                },
                icon: <Walk />,
              },
            ]}
            selected={{
              type: MenuItemType.DEFAULT,
              text: t(
                preferredAnswerSpeed.slice(0, 1)[0].toUpperCase() +
                  preferredAnswerSpeed.slice(1),
              ),
            }}
          />
        </SettingsRow>
      </div>
    </div>
  );
};

export default Preferences;
