import React, {
  memo,
  useCallback,
  useContext,
  MouseEvent,
  useMemo,
} from 'react';
import { useTranslation } from 'react-i18next';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import { ChatBubblesIcon, CodeStudioIcon } from '../../../icons';
import { TabsContext } from '../../../context/tabsContext';
import { TabTypesEnum } from '../../../types/general';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';

type Props = {
  side: 'left' | 'right';
};

const AddTabDropdown = ({ side }: Props) => {
  const { t } = useTranslation();
  const { openNewTab } = useContext(TabsContext.Handlers);

  const openChatTab = useCallback(() => {
    openNewTab({ type: TabTypesEnum.CHAT }, side);
  }, [openNewTab, side]);

  const shortcuts = useMemo(() => {
    return { newChat: ['option', 'N'], newStudio: ['option', 'shift', 'N'] };
  }, []);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, shortcuts.newChat)) {
        e.stopPropagation();
        e.preventDefault();
        openNewTab({ type: TabTypesEnum.CHAT });
      }
    },
    [openNewTab],
  );
  useKeyboardNavigation(handleKeyEvent, side !== 'left');

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
          shortcut={shortcuts.newChat}
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
          shortcut={shortcuts.newStudio}
          onClick={noPropagate}
        />
      </div>
    </div>
  );
};

export default memo(AddTabDropdown);
