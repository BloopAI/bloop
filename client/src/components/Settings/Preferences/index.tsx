import React, { useCallback, useContext, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import SettingsText from '../SettingsText';
import SettingsRow from '../SettingsRow';
import { UIContext } from '../../../context/uiContext';
import Dropdown from '../../Dropdown/Normal';
import { MenuItemType } from '../../../types/general';
import { Theme } from '../../../types';
import { previewTheme } from '../../../utils';
import { DeviceContext } from '../../../context/deviceContext';
import Checkbox from '../../Checkbox';
import { getConfig, putConfig } from '../../../services/api';
import { ContextMenuItem } from '../../ContextMenu';

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
  const { isSelfServe, envConfig, setEnvConfig } = useContext(DeviceContext);

  const themeItems = useMemo<ContextMenuItem[]>(() => {
    return Object.entries(themesMap).map(([key, name]) => ({
      type: MenuItemType.DEFAULT,
      text: t(name),
      onClick: () => setTheme(key as Theme),
      onMouseOver: () => previewTheme(key),
    }));
  }, [t]);

  const selectedThemeItem = useMemo<ContextMenuItem>(() => {
    return {
      type: MenuItemType.DEFAULT,
      text: t(themesMap[theme]),
    };
  }, [theme, t]);

  const onClose = useCallback(() => {
    previewTheme(theme);
  }, [theme]);

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
            items={themeItems}
            onClose={onClose}
            selected={selectedThemeItem}
          />
        </SettingsRow>
        {isSelfServe && (
          <SettingsRow>
            <SettingsText
              title={t('Allow analytics')}
              subtitle={t(
                'We use analytics to improve your experience. Please refresh the page after changing the value.',
              )}
            />
            <div>
              <Checkbox
                checked={
                  !!envConfig.bloop_user_profile?.allow_session_recordings
                }
                label={''}
                onChange={(b) => {
                  putConfig({
                    bloop_user_profile: {
                      ...(envConfig?.bloop_user_profile || {}),
                      allow_session_recordings: b,
                    },
                  }).then(() => {
                    getConfig().then(setEnvConfig);
                  });
                }}
              />
            </div>
          </SettingsRow>
        )}
      </div>
    </div>
  );
};

export default Preferences;
