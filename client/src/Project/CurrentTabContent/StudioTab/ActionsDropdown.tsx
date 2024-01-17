import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../../components/Dropdown/Section';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import { BroomIcon, SplitViewIcon, TrashCanIcon } from '../../../icons';
import { deleteCodeStudio, deleteConversation } from '../../../services/api';

type Props = {
  clearConversation: () => void;
  handleMoveToAnotherSide: () => void;
  refreshCurrentProjectStudios: () => void;
  closeTab: (tabKey: string, side: 'left' | 'right') => void;
  studioId?: string;
  projectId?: string;
  tabKey: string;
  side: 'left' | 'right';
};

const ActionsDropdown = ({
  handleMoveToAnotherSide,
  refreshCurrentProjectStudios,
  clearConversation,
  studioId,
  projectId,
  closeTab,
  tabKey,
  side,
}: Props) => {
  const { t } = useTranslation();

  const removeConversation = useCallback(async () => {
    if (projectId && studioId) {
      await deleteCodeStudio(projectId, studioId);
      refreshCurrentProjectStudios();
      closeTab(tabKey, side);
    }
  }, [
    projectId,
    studioId,
    closeTab,
    refreshCurrentProjectStudios,
    tabKey,
    side,
  ]);

  const shortcuts = useMemo(() => {
    return {
      splitView: ['cmd', ']'],
    };
  }, []);

  return (
    <div>
      <DropdownSection borderBottom>
        <SectionItem
          label={t('Open in split view')}
          shortcut={shortcuts.splitView}
          onClick={handleMoveToAnotherSide}
          // isFocused
          icon={<SplitViewIcon sizeClassName="w-4 h-4" />}
        />
        {studioId && (
          <SectionItem
            label={t('Clear conversation')}
            // shortcut={shortcuts.splitView}
            onClick={clearConversation}
            // isFocused
            icon={<BroomIcon sizeClassName="w-4 h-4" />}
          />
        )}
      </DropdownSection>
      <DropdownSection>
        {studioId && (
          <SectionItem
            label={t('Delete conversation')}
            // shortcut={shortcuts.splitView}
            onClick={removeConversation}
            // isFocused
            icon={<TrashCanIcon sizeClassName="w-4 h-4" />}
          />
        )}
      </DropdownSection>
    </div>
  );
};

export default memo(ActionsDropdown);
