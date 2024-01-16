import React, { memo, useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusSignIcon } from '../../../icons';
import Button from '../../../components/Button';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import { TabTypesEnum } from '../../../types/general';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { TabsContext } from '../../../context/tabsContext';
import Dropdown from '../../../components/Dropdown';
import AddTabDropdown from './AddTabDropdown';

type Props = {
  tabsLength: number;
  side: 'left' | 'right';
  focusedPanel: 'left' | 'right';
};

const newTabShortcut = ['option', 'N'];

const AddTabButton = ({ side, focusedPanel, tabsLength }: Props) => {
  const { t } = useTranslation();
  const { openNewTab } = useContext(TabsContext.Handlers);

  const dropdownComponentProps = useMemo(() => {
    return { side };
  }, [side]);

  const openChatTab = useCallback(() => {
    openNewTab({ type: TabTypesEnum.CHAT }, side);
  }, [openNewTab, side]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, newTabShortcut)) {
        e.stopPropagation();
        e.preventDefault();
        openChatTab();
      }
    },
    [openNewTab],
  );
  useKeyboardNavigation(handleKeyEvent, side !== focusedPanel);

  return (
    <Dropdown
      appendTo={document.body}
      DropdownComponent={AddTabDropdown}
      dropdownComponentProps={dropdownComponentProps}
      size="auto"
      dropdownPlacement={tabsLength > 1 ? 'bottom-end' : 'bottom-start'}
    >
      <Button variant="tertiary" size="small" onlyIcon title={t('New tab')}>
        <PlusSignIcon sizeClassName="w-4 h-4" />
      </Button>
    </Dropdown>
  );
};

export default memo(AddTabButton);
