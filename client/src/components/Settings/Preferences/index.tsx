import { useContext } from 'react';
import SettingsText from '../SettingsText';
import SettingsRow from '../SettingsRow';
import { UIContext } from '../../../context/uiContext';
import Dropdown from '../../Dropdown/Normal';
import { MenuItemType } from '../../../types/general';
import { Theme } from '../../../types';

const themesMap = {
  default: 'Default',
  'default-light': 'Default Light',
  'vsc-default-dark': 'VSCode Dark',
  'vsc-default-light': 'VSCode Light',
  abyss: 'Abyss',
  'atom-one-dark-pro': 'Atom One Dark Pro',
  darcula: 'Darcula',
  dracula: 'Dracula',
  'github-dark': 'GitHub Dark',
  'github-light': 'GitHub Light',
  'gruvbox-dark': 'Gruvbox Dark',
  'gruvbox-light': 'Gruvbox Light',
  'kimbie-dark': 'Kimbie',
  material: 'Material',
  monokai: 'Monokai',
  'night-owl': 'Night Owl',
  'quiet-light': 'Quiet Light',
  'solarized-dark': 'Solarized Dark',
  'solarized-light': 'Solarized Light',
  'tomorrow-night-blue': 'Tomorrow Night Blue',
};

const Preferences = () => {
  const { theme, setTheme } = useContext(UIContext);

  return (
    <div className="w-full relative">
      <div className="mb-6">
        <h5>Preferences</h5>
      </div>
      <div>
        <SettingsRow>
          <SettingsText
            title="Theme"
            subtitle="Select your interface color scheme"
          />
          <Dropdown
            items={Object.entries(themesMap).map(([key, name]) => ({
              type: MenuItemType.DEFAULT,
              text: name,
              onClick: () => setTheme(key as Theme),
            }))}
            selected={{
              type: MenuItemType.DEFAULT,
              text: themesMap[theme],
            }}
          />
        </SettingsRow>
      </div>
    </div>
  );
};

export default Preferences;
