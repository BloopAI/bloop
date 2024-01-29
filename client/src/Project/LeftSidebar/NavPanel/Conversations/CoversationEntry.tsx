import React, { memo, useCallback, useContext } from 'react';
import { ConversationShortType } from '../../../../types/api';
import { TabsContext } from '../../../../context/tabsContext';
import { TabTypesEnum } from '../../../../types/general';
import { useEnterKey } from '../../../../hooks/useEnterKey';

type Props = ConversationShortType & {
  index: string;
  focusedIndex: string;
  isLeftSidebarFocused: boolean;
  isCommandBarVisible: boolean;
  setFocusedIndex: (s: string) => void;
};

const ConversationEntry = ({
  title,
  id,
  index,
  focusedIndex,
  isLeftSidebarFocused,
  isCommandBarVisible,
  setFocusedIndex,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);

  const handleClick = useCallback(() => {
    openNewTab({ type: TabTypesEnum.CHAT, conversationId: id, title });
  }, [openNewTab, id, title]);

  useEnterKey(
    handleClick,
    focusedIndex !== index || !isLeftSidebarFocused || isCommandBarVisible,
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (e.movementX || e.movementY) {
        setFocusedIndex(index);
      }
    },
    [index, setFocusedIndex],
  );

  return (
    <a
      href="#"
      className={`w-full text-left h-7 flex-shrink-0 flex items-center gap-3 pr-2 cursor-pointer
        ellipsis body-mini group pl-10.5 ${
          focusedIndex === index
            ? 'bg-bg-sub-hover text-label-title'
            : 'text-label-base'
        }`}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      data-node-index={index}
    >
      <span className="ellipsis">{title}</span>
    </a>
  );
};

export default memo(ConversationEntry);
