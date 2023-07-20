import React, { useContext } from 'react';
import { MenuListItemType } from '../ContextMenu';
import DropdownWithIcon from '../Dropdown/WithIcon';
import { LocaleContext } from '../../context/localeContext';

const LanguageSelector = () => {
  const { locale, setLocale } = useContext(LocaleContext);
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
      ]}
      icon={
        <div className="flex items-center gap-2">
          <span> {locale === 'ja' ? '🇯🇵' : '🇬🇧'}</span>
          <span>{locale === 'ja' ? '日本' : 'English'}</span>
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
