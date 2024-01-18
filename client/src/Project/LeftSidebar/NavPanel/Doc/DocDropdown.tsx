import { memo, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../../../components/Dropdown/Section';
import SectionItem from '../../../../components/Dropdown/Section/SectionItem';
import { RefreshIcon, TrashCanIcon } from '../../../../icons';
import { removeDocFromProject, resyncDoc } from '../../../../services/api';
import { ProjectContext } from '../../../../context/projectContext';

type Props = {
  docId: string;
};

const ConversationsDropdown = ({ docId }: Props) => {
  const { t } = useTranslation();
  const { project, refreshCurrentProjectDocs } = useContext(
    ProjectContext.Current,
  );

  const handleRemoveFromProject = useCallback(async () => {
    if (project?.id) {
      await removeDocFromProject(project?.id, docId);
      refreshCurrentProjectDocs();
    }
  }, [docId, project?.id]);

  const handleResync = useCallback(() => {
    return resyncDoc(docId);
  }, []);

  return (
    <div>
      <DropdownSection borderBottom>
        <SectionItem
          onClick={handleResync}
          label={t('Re-sync')}
          icon={<RefreshIcon sizeClassName="w-4 h-4" />}
        />
      </DropdownSection>
      <DropdownSection>
        <SectionItem
          onClick={handleRemoveFromProject}
          label={t('Remove from project')}
          icon={<TrashCanIcon sizeClassName="w-4 h-4" />}
        />
      </DropdownSection>
    </div>
  );
};

export default memo(ConversationsDropdown);
