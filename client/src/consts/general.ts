import { LocaleType } from '../types/general';

export const themesMap = {
  system: 'System Preference',
  dark: 'Dark',
  light: 'Light',
  black: 'Black',
};

export const localesMap: Record<LocaleType, { name: string; icon: string }> = {
  en: { name: 'English', icon: '🇬🇧' },
  ja: { name: '日本', icon: '🇯🇵' },
  zhCN: { name: '简体中文', icon: '🇨🇳' },
  es: { name: 'Español', icon: '🇪🇸' },
  it: { name: 'Italiano', icon: '🇮🇹' },
};
