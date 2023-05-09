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
  monokai: 'Monokai',
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
