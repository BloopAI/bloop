import { memo, useCallback, useContext } from 'react';
import { ConversationShortType } from '../../../types/api';
import { TabsContext } from '../../../context/tabsContext';
import { TabTypesEnum } from '../../../types/general';

type Props = ConversationShortType & {};

const ConversationEntry = ({ title, id }: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);

  const handleClick = useCallback(() => {
    openNewTab({ type: TabTypesEnum.CHAT, conversationId: id, title });
  }, [openNewTab, id, title]);

  return (
    <a
      href="#"
      className={`w-full text-left h-7 flex-shrink-0 flex items-center gap-3 pr-2 cursor-pointer
        ellipsis body-mini group
        hover:bg-bg-base-hover hover:text-label-title active:bg-transparent text-label-base pl-[2.625rem]`}
      onClick={handleClick}
    >
      <span className="ellipsis">{title}</span>
    </a>
  );
};

export default memo(ConversationEntry);
