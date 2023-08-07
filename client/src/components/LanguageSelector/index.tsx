import React, { useContext } from 'react';
import { MenuListItemType } from '../ContextMenu';
import DropdownWithIcon from '../Dropdown/WithIcon';
import { LocaleContext } from '../../context/localeContext';
import { LocaleType } from '../../types/general';

const localesMap: Record<LocaleType, { name: string; icon: string }> = {
  en: { name: 'English', icon: '🇬🇧' },
  ja: { name: '日本', icon: '🇯🇵' },
  zhCN: { name: '简体中文', icon: '🇨🇳' },
  es: { name: 'Español', icon: '🇪🇸' },
};

const LanguageSelector = () => {
  const { locale, setLocale } = useContext(LocaleContext);

  return (
    <DropdownWithIcon
      items={Object.entries(localesMap).map(([key, value]) => ({
        text: value.name,
        icon: <span>{value.icon}</span>,
        type: MenuListItemType.DEFAULT,
        onClick: () => {
          setLocale(key as LocaleType);
        },
      }))}
      icon={
        <div className="flex items-center gap-2">
          <span> {localesMap[locale]?.icon}</span>
          <span>{localesMap[locale]?.name}</span>
        </div>
      }
      noChevron
      dropdownBtnClassName=""
      btnSize="small"
      btnVariant="tertiary"
      size="small"
      appendTo={document.body}
    />
  );
};

export default LanguageSelector;
