import { memo, useCallback, useContext } from 'react';
import { ConversationShortType } from '../../../../types/api';
import { TabsContext } from '../../../../context/tabsContext';
import { TabTypesEnum } from '../../../../types/general';
import { useEnterKey } from '../../../../hooks/useEnterKey';

type Props = ConversationShortType & {
  index: string;
  focusedIndex: string;
  isLeftSidebarFocused: boolean;
  isCommandBarVisible: boolean;
};

const ConversationEntry = ({
  title,
  id,
  index,
  focusedIndex,
  isLeftSidebarFocused,
  isCommandBarVisible,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);

  const handleClick = useCallback(() => {
    openNewTab({ type: TabTypesEnum.CHAT, conversationId: id, title });
  }, [openNewTab, id, title]);

  useEnterKey(
    handleClick,
    focusedIndex !== index || !isLeftSidebarFocused || isCommandBarVisible,
  );

  return (
    <a
      href="#"
      className={`w-full text-left h-7 flex-shrink-0 flex items-center gap-3 pr-2 cursor-pointer
        ellipsis body-mini group ${
          focusedIndex === index
            ? 'bg-bg-sub-hover text-label-title'
            : 'text-label-base'
        }
        hover:bg-bg-base-hover hover:text-label-title active:bg-transparent pl-10.5`}
      onClick={handleClick}
      data-node-index={index}
    >
      <span className="ellipsis">{title}</span>
    </a>
  );
};

export default memo(ConversationEntry);
