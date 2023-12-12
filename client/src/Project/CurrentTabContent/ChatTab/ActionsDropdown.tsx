import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../../components/Dropdown/Section';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import { SplitViewIcon } from '../../../icons';

type Props = {
  handleMoveToAnotherSide: () => void;
};

const ActionsDropdown = ({ handleMoveToAnotherSide }: Props) => {
  const { t } = useTranslation();

  const shortcuts = useMemo(() => {
    return {
      splitView: ['cmd', ']'],
    };
  }, []);

  return (
    <div>
      <DropdownSection>
        <SectionItem
          label={t('Open in split view')}
          shortcut={shortcuts.splitView}
          onClick={handleMoveToAnotherSide}
          isFocused
          icon={<SplitViewIcon sizeClassName="w-4 h-4" />}
        />
      </DropdownSection>
    </div>
  );
};

export default memo(ActionsDropdown);
