import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusSignIcon } from '../../../icons';
import Button from '../../../components/Button';
import Dropdown from '../../../components/Dropdown';
import AddTabDropdown from './AddTabDropdown';

type Props = {
  tabsLength: number;
  side: 'left' | 'right';
};

const AddTabButton = ({ tabsLength, side }: Props) => {
  const { t } = useTranslation();

  const dropdownComponentProps = useMemo(() => {
    return { side };
  }, [side]);

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
