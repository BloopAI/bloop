import { memo, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../../components/Dropdown/Section';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import { TrashCanIcon } from '../../../icons';
import { deleteConversation } from '../../../services/api';
import { ProjectContext } from '../../../context/projectContext';

type Props = {};

const ConversationsDropdown = ({}: Props) => {
  const { t } = useTranslation();
  const { project, refreshCurrentProjectConversations } = useContext(
    ProjectContext.Current,
  );

  const handleRemoveAllConversations = useCallback(async () => {
    if (project?.id && project.conversations.length) {
      await Promise.allSettled(
        project.conversations.map((c) => deleteConversation(project.id, c.id)),
      );
      refreshCurrentProjectConversations();
    }
  }, [project?.id, project?.conversations]);

  return (
    <div>
      <DropdownSection>
        <SectionItem
          onClick={handleRemoveAllConversations}
          label={t('Delete all conversations')}
          icon={<TrashCanIcon sizeClassName="w-4 h-4" />}
        />
      </DropdownSection>
    </div>
  );
};

export default memo(ConversationsDropdown);
