import React, { useContext, useMemo } from 'react';
import { MenuListItemType } from '../ContextMenu';
import DropdownWithIcon from '../Dropdown/WithIcon';
import { LocaleContext } from '../../context/localeContext';

const LanguageSelector = () => {
  const { locale, setLocale } = useContext(LocaleContext);

  const { langTag, langName } = useMemo(() => {
    switch (locale) {
      case 'ja':
        return { langTag: '🇯🇵', langName: '日本' };

      case 'zhCN':
        return { langTag: '🇨🇳', langName: '简体中文' };

      default:
        return { langTag: '🇬🇧', langName: 'English' };
    }
  }, [locale]);

  return (
    <DropdownWithIcon
      items={[
        {
          text: 'English',
          icon: <span>🇬🇧</span>,
          type: MenuListItemType.DEFAULT,
          onClick: () => {
            setLocale('en');
          },
        },
        {
          text: '日本',
          icon: <span>🇯🇵</span>,
          type: MenuListItemType.DEFAULT,
          onClick: () => {
            setLocale('ja');
          },
        },
        {
          text: '简体中文',
          icon: <span>🇨🇳</span>,
          type: MenuListItemType.DEFAULT,
          onClick: () => {
            setLocale('zhCN');
          },
        },
      ]}
      icon={
        <div className="flex items-center gap-2">
          <span>{langTag}</span>
          <span>{langName}</span>
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
