import React, { memo, useCallback, useContext } from 'react';
import { ConversationShortType } from '../../../../types/api';
import { TabsContext } from '../../../../context/tabsContext';
import { TabTypesEnum } from '../../../../types/general';
import { useArrowNavigationItemProps } from '../../../../hooks/useArrowNavigationItemProps';

type Props = ConversationShortType & {
  index: string;
  isCurrentPath?: boolean;
};

const ConversationEntry = ({ title, id, index, isCurrentPath }: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);

  const onClick = useCallback(() => {
    openNewTab({ type: TabTypesEnum.CHAT, conversationId: id, title });
  }, [openNewTab, id, title]);

  const { isFocused, isLeftSidebarFocused, props } =
    useArrowNavigationItemProps<HTMLAnchorElement>(index, onClick);

  return (
    <a
      href="#"
      className={`w-full text-left h-7 flex-shrink-0 flex items-center gap-3 pr-2 cursor-pointer
        ellipsis body-mini group pl-10.5 ${
          isCurrentPath
            ? isLeftSidebarFocused
              ? 'bg-bg-shade-hover text-label-title'
              : 'bg-bg-shade text-label-title'
            : isFocused
            ? 'bg-bg-sub-hover text-label-title'
            : 'text-label-base'
        }`}
      {...props}
    >
      <span className="ellipsis">{title}</span>
    </a>
  );
};

export default memo(ConversationEntry);
