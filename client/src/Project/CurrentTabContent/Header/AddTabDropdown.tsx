import React, { memo, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import { ChatBubblesIcon, CodeStudioIcon } from '../../../icons';
import { TabsContext } from '../../../context/tabsContext';
import { TabTypesEnum } from '../../../types/general';
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
          label={t('New conversation')}
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
          label={t('New studio conversation')}
          shortcut={newStudioTabShortcut}
          onClick={openStudioTab}
        />
      </div>
    </div>
  );
};

export default memo(AddTabDropdown);
