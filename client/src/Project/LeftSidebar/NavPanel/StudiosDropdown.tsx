import { memo, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../../components/Dropdown/Section';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import { TrashCanIcon } from '../../../icons';
import { deleteCodeStudio } from '../../../services/api';
import { ProjectContext } from '../../../context/projectContext';

type Props = {};

const StudiosDropdown = ({}: Props) => {
  const { t } = useTranslation();
  const { project, refreshCurrentProjectStudios } = useContext(
    ProjectContext.Current,
  );

  const handleRemoveAllStudios = useCallback(async () => {
    if (project?.id && project.studios.length) {
      await Promise.allSettled(
        project.studios.map((c) => deleteCodeStudio(project.id, c.id)),
      );
      refreshCurrentProjectStudios();
    }
  }, [project?.id, project?.studios]);

  return (
    <div>
      <DropdownSection>
        <SectionItem
          onClick={handleRemoveAllStudios}
          label={t('Delete all conversations')}
          icon={<TrashCanIcon sizeClassName="w-4 h-4" />}
        />
      </DropdownSection>
    </div>
  );
};

export default memo(StudiosDropdown);
