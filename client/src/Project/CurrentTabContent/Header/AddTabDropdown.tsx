import React, { memo, useCallback, useContext, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import { ChatBubblesIcon, CodeStudioIcon } from '../../../icons';
import { TabsContext } from '../../../context/tabsContext';
import { TabTypesEnum } from '../../../types/general';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { postCodeStudio } from '../../../services/api';
import { ProjectContext } from '../../../context/projectContext';
import {
  newChatTabShortcut,
  newStudioTabShortcut,
} from '../../../consts/shortcuts';

type Props = {
  side: 'left' | 'right';
};

const AddTabDropdown = ({ side }: Props) => {
  const { t } = useTranslation();
  const { openNewTab } = useContext(TabsContext.Handlers);
  const { focusedPanel } = useContext(TabsContext.All);
  const { refreshCurrentProjectStudios, project } = useContext(
    ProjectContext.Current,
  );

  const openChatTab = useCallback(() => {
    openNewTab({ type: TabTypesEnum.CHAT }, side);
  }, [openNewTab, side]);

  const openStudioTab = useCallback(async () => {
    if (project?.id) {
      const newId = await postCodeStudio(project?.id);
      refreshCurrentProjectStudios();
      openNewTab({ type: TabTypesEnum.STUDIO, studioId: newId }, side);
    }
  }, [openNewTab, side, project?.id]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, newChatTabShortcut)) {
        e.stopPropagation();
        e.preventDefault();
        openChatTab();
      } else if (checkEventKeys(e, newStudioTabShortcut)) {
        e.stopPropagation();
        e.preventDefault();
        openStudioTab();
      }
    },
    [openChatTab, openStudioTab],
  );
  useKeyboardNavigation(handleKeyEvent, side !== focusedPanel);

  const noPropagate = useCallback((e?: MouseEvent) => {
    e?.stopPropagation();
  }, []);

  return (
    <div>
      <div className="flex flex-col p-1 items-start border-y border-bg-border">
        <SectionItem
          icon={
            <ChatBubblesIcon
              sizeClassName="w-4 h-4"
              className="text-brand-default"
            />
          }
          label={t('New Chat')}
          shortcut={newChatTabShortcut}
          onClick={openChatTab}
        />
        <SectionItem
          icon={
            <CodeStudioIcon
              sizeClassName="w-4 h-4"
              className="text-brand-studio"
            />
          }
          label={t('New Code Studio')}
          shortcut={newStudioTabShortcut}
          onClick={openStudioTab}
        />
      </div>
    </div>
  );
};

export default memo(AddTabDropdown);
