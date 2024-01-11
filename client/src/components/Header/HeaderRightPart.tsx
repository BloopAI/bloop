import React, { memo, useCallback, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../Button';
import { KLetterIcon, PersonIcon } from '../../icons';
import Dropdown from '../Dropdown';
import { CommandBarContext } from '../../context/commandBarContext';
import { EnvContext } from '../../context/envContext';
import useShortcuts from '../../hooks/useShortcuts';
import UserDropdown from './UserDropdown';

type Props = {};

const HeaderRightPart = ({}: Props) => {
  useTranslation();
  const { envConfig } = useContext(EnvContext);
  const { setIsVisible } = useContext(CommandBarContext.Handlers);

  const openCommandBar = useCallback(() => {
    setIsVisible(true);
  }, []);

  const shortcut = useShortcuts(['cmd', 'K']);

  return (
    <div className="flex pl-2 pr-4 items-center gap-2 h-full">
      <Button variant="tertiary" size="mini" onClick={openCommandBar}>
        <KLetterIcon sizeClassName="w-3.5 h-3.5" className="-translate-y-px" />
        <Trans>Actions</Trans>
        <span className="text-label-faint">{shortcut?.join(' ')}</span>
      </Button>
      <Dropdown DropdownComponent={UserDropdown} dropdownPlacement="bottom-end">
        {envConfig.github_user?.avatar_url ? (
          <div className="w-5 h-5 rounded-full overflow-hidden">
            <img src={envConfig.github_user?.avatar_url} alt="avatar" />
          </div>
        ) : (
          <PersonIcon sizeClassName="w-3.5 h-3.5" />
        )}
      </Dropdown>
    </div>
  );
};

export default memo(HeaderRightPart);
