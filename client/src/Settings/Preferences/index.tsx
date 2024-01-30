import React, { memo, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Dropdown from '../../components/Dropdown';
import Button from '../../components/Button';
import {
  ChevronDownIcon,
  MacintoshIcon,
  ThemeBlackIcon,
  ThemeDarkIcon,
  ThemeLightIcon,
} from '../../icons';
import { UIContext } from '../../context/uiContext';
import { localesMap, themesMap } from '../../consts/general';
import { LocaleContext } from '../../context/localeContext';
import ThemeDropdown from './ThemeDropdown';
import LanguageDropdown from './LanguageDropdown';

type Props = {};

export const themeIconsMap = {
  light: <ThemeLightIcon sizeClassName="w-4.5 h-4.5" />,
  dark: <ThemeDarkIcon sizeClassName="w-4.5 h-4.5" />,
  black: <ThemeBlackIcon sizeClassName="w-4.5 h-4.5" />,
  system: <MacintoshIcon sizeClassName="w-4.5 h-4.5" />,
};
const Preferences = ({}: Props) => {
  useTranslation();
  const { theme } = useContext(UIContext.Theme);
  const { locale } = useContext(LocaleContext);

  return (
    <div className="w-[36.25rem] flex flex-col flex-2">
      <div className="flex flex-col gap-3 ">
        <p className="body-m text-label-title">
          <Trans>Preferences</Trans>
        </p>
        <p className="body-s-b text-label-muted">
          <Trans>Manage your preferences</Trans>
        </p>
      </div>
      <hr className="border-bg-divider my-8" />
      <div className="flex items-start gap-8 w-full justify-between">
        <div className="flex flex-col gap-2">
          <p className="body-base-b text-label-title">
            <Trans>Theme</Trans>
          </p>
          <p className="body-s-b text-label-muted">
            <Trans>Select the interface colour scheme</Trans>
          </p>
        </div>
        <Dropdown
          DropdownComponent={ThemeDropdown}
          size="small"
          dropdownPlacement="bottom-end"
        >
          <Button variant="secondary">
            {themeIconsMap[theme]}
            <Trans>{themesMap[theme]}</Trans>
            <ChevronDownIcon sizeClassName="w-4 h-4" />
          </Button>
        </Dropdown>
      </div>
      <hr className="border-bg-divider my-8" />
      <div className="flex items-start gap-8 w-full justify-between">
        <div className="flex flex-col gap-2">
          <p className="body-base-b text-label-title">
            <Trans>Language</Trans>
          </p>
          <p className="body-s-b text-label-muted">
            <Trans>Select the interface language</Trans>
          </p>
        </div>
        <Dropdown
          DropdownComponent={LanguageDropdown}
          size="small"
          dropdownPlacement="bottom-end"
        >
          <Button variant="secondary">
            <span>{localesMap[locale].icon}</span>
            {localesMap[locale].name}
            <ChevronDownIcon sizeClassName="w-4 h-4" />
          </Button>
        </Dropdown>
      </div>
    </div>
  );
};

export default memo(Preferences);
