import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../components/Dropdown/Section';
import SectionItem from '../../components/Dropdown/Section/SectionItem';
import { PencilIcon, TrashCanIcon } from '../../icons';

type Props = {
  isDefault: boolean;
  handleEdit: () => void;
  handleDelete: () => void;
};

const ActionsDropdown = ({ handleEdit, handleDelete, isDefault }: Props) => {
  const { t } = useTranslation();

  return (
    <div>
      <DropdownSection borderBottom={!isDefault}>
        <SectionItem
          label={t('Edit template')}
          onClick={handleEdit}
          icon={<PencilIcon sizeClassName="w-4 h-4" />}
        />
      </DropdownSection>
      {!isDefault && (
        <DropdownSection>
          <SectionItem
            label={t('Delete template')}
            onClick={handleDelete}
            icon={<TrashCanIcon sizeClassName="w-4 h-4" />}
          />
        </DropdownSection>
      )}
    </div>
  );
};

export default memo(ActionsDropdown);
