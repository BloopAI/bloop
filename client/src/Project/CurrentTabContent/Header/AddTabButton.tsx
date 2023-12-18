import React, { memo, useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusSignIcon } from '../../../icons';
import Button from '../../../components/Button';
import Dropdown from '../../../components/Dropdown';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import { TabTypesEnum } from '../../../types/general';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { TabsContext } from '../../../context/tabsContext';
import AddTabDropdown from './AddTabDropdown';

type Props = {
  tabsLength: number;
  side: 'left' | 'right';
  focusedPanel: 'left' | 'right';
};

const AddTabButton = ({ tabsLength, side, focusedPanel }: Props) => {
  const { t } = useTranslation();
  const { openNewTab } = useContext(TabsContext.Handlers);

  const dropdownComponentProps = useMemo(() => {
    return { side };
  }, [side]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, ['option', 'N'])) {
        e.stopPropagation();
        e.preventDefault();
        openNewTab({ type: TabTypesEnum.CHAT });
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
      <Button variant="tertiary" size="small" onlyIcon title={t('Add tab')}>
        <PlusSignIcon sizeClassName="w-4 h-4" />
      </Button>
    </Dropdown>
  );
};

export default memo(AddTabButton);
