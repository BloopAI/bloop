import { memo, useCallback, useContext } from 'react';
import { ConversationShortType, DocPageType } from '../../../../types/api';
import { TabsContext } from '../../../../context/tabsContext';
import { TabTypesEnum } from '../../../../types/general';
import { useEnterKey } from '../../../../hooks/useEnterKey';
import { FileIcon } from '../../../../icons';

type Props = DocPageType & {
  index: string;
  focusedIndex: string;
  isLeftSidebarFocused: boolean;
  isCommandBarVisible: boolean;
};

const DocEntry = ({
  index,
  focusedIndex,
  isLeftSidebarFocused,
  isCommandBarVisible,
  doc_id,
  doc_source,
  doc_title,
  relative_url,
  absolute_url,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);

  const handleClick = useCallback(() => {
    // openNewTab({ type: TabTypesEnum.CHAT, conversationId: id, title });
  }, [openNewTab]);

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
      <FileIcon sizeClassName="w-3.5 h-3.5" />
      <span className="ellipsis">{doc_title}</span>
    </a>
  );
};

export default memo(DocEntry);
