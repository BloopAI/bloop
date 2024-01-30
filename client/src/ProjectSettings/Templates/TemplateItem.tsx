import React, { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StudioTemplateType } from '../../types/api';
import { MoreHorizontalIcon, TemplatesIcon } from '../../icons';
import Button from '../../components/Button';
import Dropdown from '../../components/Dropdown';
import { deleteTemplate } from '../../services/api';
import ActionsDropdown from './ActionsDropdown';

type Props = StudioTemplateType & {
  refetchTemplates: () => void;
  handleEdit: (t: StudioTemplateType) => void;
};

const TemplateItem = ({
  name,
  content,
  id,
  is_default,
  refetchTemplates,
  handleEdit,
  modified_at,
}: Props) => {
  const { t } = useTranslation();

  const handleDelete = useCallback(async () => {
    await deleteTemplate(id);
    refetchTemplates();
  }, [id]);

  const dropdownComponentProps = useMemo(() => {
    return {
      isDefault: is_default,
      handleDelete,
      handleEdit: () =>
        handleEdit({ id, name, content, is_default, modified_at }),
    };
  }, [is_default, handleDelete, handleEdit, id]);

  return (
    <div className="flex p-4 items-center gap-3 bg-bg-sub overflow-hidden hover:bg-bg-sub-hover">
      <div className="flex items-center justify-center w-10 h-10 rounded-6 bg-bg-shade flex-shrink-0">
        <TemplatesIcon sizeClassName="w-4.5 h-4.5" />
      </div>
      <div className="flex flex-col gap-1.5 flex-1 ellipsis">
        <p className="body-s-b text-label-title">{name}</p>
        <p className="body-mini text-label-base ellipsis">{content}</p>
      </div>
      <div>
        <Dropdown
          DropdownComponent={ActionsDropdown}
          dropdownComponentProps={dropdownComponentProps}
          appendTo={document.body}
          dropdownPlacement="bottom-end"
        >
          <Button
            variant="tertiary"
            size="mini"
            onlyIcon
            title={t('More actions')}
          >
            <MoreHorizontalIcon sizeClassName="w-3.5 h-3.5" />
          </Button>
        </Dropdown>
      </div>
    </div>
  );
};

export default memo(TemplateItem);
