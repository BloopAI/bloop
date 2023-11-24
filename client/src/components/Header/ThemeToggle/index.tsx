import { memo, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UIContext } from '../../../context/uiContext';
import {
  getPlainFromStorage,
  savePlainToStorage,
  THEME,
} from '../../../services/storage';
import { Theme } from '../../../types';
import Tab from './ThemeTab';

type Props = {};

const Index = ({}: Props) => {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>(
    (getPlainFromStorage(THEME) as 'system' | null) || 'system',
  );

  useEffect(() => {
    savePlainToStorage(THEME, theme);
    document.body.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="w-full flex p-0.5 gap-0.5 rounded-5 bg-bg-base">
      <Tab
        label={t('Dark')}
        value="default"
        setTheme={setTheme}
        isActive={theme === 'default'}
      />
      <Tab
        label={t('Light')}
        value="default-light"
        setTheme={setTheme}
        isActive={theme === 'default-light'}
      />
      <Tab
        label={t('System')}
        value="system"
        setTheme={setTheme}
        isActive={theme === 'system'}
      />
    </div>
  );
};

export default memo(Index);
