import React, {
  memo,
  MouseEvent,
  useCallback,
  useContext,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useDrag, useDrop } from 'react-dnd';
import {
  DraggableTabItem,
  TabType,
  TabTypesEnum,
} from '../../../types/general';
import FileIcon from '../../../components/FileIcon';
import { splitPath } from '../../../utils';
import Button from '../../../components/Button';
import { ChatBubblesIcon, CloseSignIcon } from '../../../icons';
import { TabsContext } from '../../../context/tabsContext';

type Props = TabType & {
  tabKey: string;
  isActive: boolean;
  side: 'left' | 'right';
  isOnlyTab: boolean;
  moveTab: (i: number, j: number) => void;
  i: number;
  repoRef?: string;
  path?: string;
  threadId?: string;
  name?: string;
};

const TabButton = ({
  isActive,
  tabKey,
  repoRef,
  path,
  threadId,
  type,
  name,
  side,
  moveTab,
  isOnlyTab,
  i,
}: Props) => {
  const { t } = useTranslation();
  const { closeTab, setActiveLeftTab, setActiveRightTab, setFocusedPanel } =
    useContext(TabsContext.Handlers);
  const ref = useRef<HTMLAnchorElement>(null);
  const [{ handlerId }, drop] = useDrop({
    accept: `tab-${side}`,
    canDrop: (item: DraggableTabItem) => item.side === side,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DraggableTabItem, monitor) {
      if (!ref.current || item.side !== side) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = i;
      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }
      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      // Get vertical middle
      const hoverMiddleX =
        (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      // Get pixels to the top
      const hoverClientX = (clientOffset?.x || 0) - hoverBoundingRect.left;
      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%
      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) {
        return;
      }
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) {
        return;
      }
      // Time to actually perform the action
      moveTab(dragIndex, hoverIndex);
      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });
  const [{ isDragging }, drag] = useDrag({
    type: `tab-${side}`,
    canDrag: side !== 'left' || !isOnlyTab,
    item: (): DraggableTabItem => {
      return {
        id: tabKey,
        index: i,
        // @ts-ignore
        t: { key: tabKey, repoRef, path, type, threadId, name },
        side,
      };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  drag(drop(ref));

  const handleClose = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      closeTab(tabKey, side);
    },
    [tabKey, side],
  );

  const handleClick = useCallback(() => {
    const setAction = side === 'left' ? setActiveLeftTab : setActiveRightTab;
    // @ts-ignore
    setAction({ path, repoRef, key: tabKey, type, threadId, name });
    setFocusedPanel(side);
  }, [path, repoRef, tabKey, side]);

  return (
    <a
      href="#"
      ref={ref}
      onClick={handleClick}
      className={`flex h-7 max-w-[9rem] gap-1.5 pl-2 pr-1.5 ${
        isDragging
          ? 'opacity-0 border border-bg-border-selected bg-bg-selected'
          : 'opacity-100'
      } flex-shrink-0 items-center rounded ellipsis group ${
        isActive ? 'bg-bg-base-hover' : ''
      } hover:bg-bg-base-hover transition duration-75 ease-in-out select-none`}
      data-handler-id={handlerId}
    >
      {type === TabTypesEnum.FILE ? (
        <FileIcon filename={path} noMargin />
      ) : (
        <ChatBubblesIcon
          sizeClassName="w-4 h-4"
          className="text-brand-default"
        />
      )}
      <p
        className={`body-mini-b ellipsis group-hover:text-label-title flex-1 ${
          isActive ? 'text-label-title' : 'text-label-muted'
        } transition duration-75 ease-in-out`}
      >
        {type === TabTypesEnum.FILE ? splitPath(path).pop() : 'New chat'}
      </p>
      <Button
        variant="ghost"
        size="mini"
        onlyIcon
        title={t('Close')}
        className={`opacity-0 group-hover:opacity-100 ${
          isActive ? 'opacity-100' : ''
        }`}
        onClick={handleClose}
      >
        <CloseSignIcon sizeClassName={'w-3 h-3'} />
      </Button>
    </a>
  );
};

export default memo(TabButton);
