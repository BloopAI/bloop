import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../../components/Dropdown/Section';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';

type Props = {
  handleExplain: () => void;
};

const ActionsDropdown = ({ handleExplain }: Props) => {
  const { t } = useTranslation();

  const shortcuts = useMemo(() => {
    return {
      explain: ['cmd', 'E'],
    };
  }, []);

  return (
    <div>
      <DropdownSection>
        <SectionItem
          label={t('Explain file')}
          onClick={handleExplain}
          isFocused
          shortcut={shortcuts.explain}
        />
      </DropdownSection>
    </div>
  );
};

export default memo(ActionsDropdown);
