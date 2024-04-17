import { memo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import SectionItem from '../../components/Dropdown/Section/SectionItem';
import {
  MacintoshIcon,
  ThemeBlackIcon,
  ThemeDarkIcon,
  ThemeLightIcon,
} from '../../icons';
import { UIContext } from '../../context/uiContext';

type Props = {};

const ThemeDropdown = ({}: Props) => {
  const { t } = useTranslation();
  const { theme, setTheme } = useContext(UIContext.Theme);

  return (
    <div>
      <div className="flex flex-col p-1 items-start border-b border-bg-border">
        <SectionItem
          index={'theme-system'}
          isSelected={theme === 'system'}
          onClick={() => setTheme('system')}
          label={t('System preferences')}
          icon={<MacintoshIcon sizeClassName="w-4 h-4" />}
        />
      </div>
      <div className="flex flex-col p-1 items-start">
        <SectionItem
          index={'theme-light'}
          isSelected={theme === 'light'}
          onClick={() => setTheme('light')}
          label={t('Light')}
          icon={<ThemeLightIcon sizeClassName="w-4 h-4" />}
        />
        <SectionItem
          index={'theme-dark'}
          isSelected={theme === 'dark'}
          onClick={() => setTheme('dark')}
          label={t('Dark')}
          icon={<ThemeDarkIcon sizeClassName="w-4 h-4" />}
        />
        <SectionItem
          index={'theme-black'}
          isSelected={theme === 'black'}
          onClick={() => setTheme('black')}
          label={t('Black')}
          icon={<ThemeBlackIcon sizeClassName="w-4 h-4" />}
        />
      </div>
    </div>
  );
};

export default memo(ThemeDropdown);
