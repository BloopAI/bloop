import React, { useContext, useMemo } from 'react';
import { MenuListItemType } from '../ContextMenu';
import DropdownWithIcon from '../Dropdown/WithIcon';
import { LocaleContext } from '../../context/localeContext';

const localesMap = {
  en: { name: 'English', icon: '🇬🇧' },
  ja: { name: '日本', icon: '🇯🇵' },
  zhCN: { name: '简体中文', icon: '🇨🇳' },
};

const LanguageSelector = () => {
  const { locale, setLocale } = useContext(LocaleContext);

  return (
    <DropdownWithIcon
      items={[
        {
          text: localesMap.en.name,
          icon: <span>{localesMap.en.icon}</span>,
          type: MenuListItemType.DEFAULT,
          onClick: () => {
            setLocale('en');
          },
        },
        {
          text: localesMap.ja.name,
          icon: <span>{localesMap.ja.icon}</span>,
          type: MenuListItemType.DEFAULT,
          onClick: () => {
            setLocale('ja');
          },
        },
        {
          text: localesMap.zhCN.name,
          icon: <span>{localesMap.zhCN.icon}</span>,
          type: MenuListItemType.DEFAULT,
          onClick: () => {
            setLocale('zhCN');
          },
        },
      ]}
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
