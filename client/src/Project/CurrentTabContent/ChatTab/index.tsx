import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import {
  ChatBubblesIcon,
  MoreHorizontalIcon,
  SplitViewIcon,
} from '../../../icons';
import Dropdown from '../../../components/Dropdown';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { TabsContext } from '../../../context/tabsContext';
import { ChatTabType } from '../../../types/general';
import { ProjectContext } from '../../../context/projectContext';
import { CommandBarContext } from '../../../context/commandBarContext';
import { openInSplitViewShortcut } from '../../../consts/commandBar';
import { UIContext } from '../../../context/uiContext';
import Conversation from './Conversation';
import ActionsDropdown from './ActionsDropdown';

type Props = ChatTabType & {
  noBorder?: boolean;
  side: 'left' | 'right';
  tabKey: string;
  handleMoveToAnotherSide: () => void;
};

const ChatTab = ({
  noBorder,
  side,
  title,
  conversationId,
  tabKey,
  handleMoveToAnotherSide,
}: Props) => {
  const { t } = useTranslation();
  const { focusedPanel } = useContext(TabsContext.All);
  const { closeTab } = useContext(TabsContext.Handlers);
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const { setFocusedTabItems } = useContext(CommandBarContext.Handlers);
  const { project, refreshCurrentProjectConversations } = useContext(
    ProjectContext.Current,
  );

  const dropdownComponentProps = useMemo(() => {
    return {
      handleMoveToAnotherSide,
      conversationId,
      projectId: project?.id,
      tabKey,
      closeTab,
      refreshCurrentProjectConversations,
      side,
    };
  }, [
    handleMoveToAnotherSide,
    conversationId,
    closeTab,
    project?.id,
    tabKey,
    refreshCurrentProjectConversations,
    side,
  ]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, ['cmd', ']'])) {
        handleMoveToAnotherSide();
      }
    },
    [handleMoveToAnotherSide],
  );
  useKeyboardNavigation(
    handleKeyEvent,
    focusedPanel !== side || isLeftSidebarFocused,
  );

  useEffect(() => {
    if (focusedPanel === side) {
      setFocusedTabItems([
        {
          label: t('Open in split view'),
          Icon: SplitViewIcon,
          id: 'split_view',
          key: 'split_view',
          onClick: handleMoveToAnotherSide,
          closeOnClick: true,
          shortcut: openInSplitViewShortcut,
          footerHint: '',
          footerBtns: [{ label: t('Move'), shortcut: ['entr'] }],
        },
      ]);
    }
  }, [focusedPanel, side, handleMoveToAnotherSide]);

  return (
    <div
      className={`flex flex-col flex-1 h-full overflow-auto ${
        noBorder ? '' : 'border-l border-bg-border'
      }`}
    >
      <div className="w-full h-10 px-4 flex justify-between items-center flex-shrink-0 border-b border-bg-border bg-bg-sub">
        <div className="flex items-center gap-3 body-s text-label-title ellipsis">
          <ChatBubblesIcon
            sizeClassName="w-4 h-4"
            className="text-brand-default"
          />
          {title || t('New chat')}
        </div>
        {focusedPanel === side && (
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
        )}
      </div>
      <div className="flex-1 flex flex-col max-w-full px-4 overflow-auto">
        <Conversation side={side} tabKey={tabKey} />
      </div>
    </div>
  );
};

export default memo(ChatTab);
