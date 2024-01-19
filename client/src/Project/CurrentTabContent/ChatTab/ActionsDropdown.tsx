import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../../components/Dropdown/Section';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import { SplitViewIcon, TrashCanIcon } from '../../../icons';
import { deleteConversation } from '../../../services/api';
import { openInSplitViewShortcut } from '../../../consts/shortcuts';

type Props = {
  handleMoveToAnotherSide: () => void;
  refreshCurrentProjectConversations: () => void;
  closeTab: (tabKey: string, side: 'left' | 'right') => void;
  conversationId?: string;
  projectId?: string;
  tabKey: string;
  side: 'left' | 'right';
};

const ActionsDropdown = ({
  handleMoveToAnotherSide,
  refreshCurrentProjectConversations,
  conversationId,
  projectId,
  closeTab,
  tabKey,
  side,
}: Props) => {
  const { t } = useTranslation();

  const removeConversation = useCallback(async () => {
    if (projectId && conversationId) {
      await deleteConversation(projectId, conversationId);
      refreshCurrentProjectConversations();
      closeTab(tabKey, side);
    }
  }, [
    projectId,
    conversationId,
    closeTab,
    refreshCurrentProjectConversations,
    tabKey,
    side,
  ]);

  return (
    <div>
      <DropdownSection>
        <SectionItem
          label={t('Open in split view')}
          shortcut={openInSplitViewShortcut}
          onClick={handleMoveToAnotherSide}
          icon={<SplitViewIcon sizeClassName="w-4 h-4" />}
        />
        {conversationId && (
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
