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
import {
  ChatBubblesIcon,
  CloseSignIcon,
  CodeStudioIcon,
  MagazineIcon,
} from '../../../icons';
import { TabsContext } from '../../../context/tabsContext';

type Props = TabType & {
  tabKey: string;
  isActive: boolean;
  side: 'left' | 'right';
  isOnlyTab: boolean;
  moveTab: (
    i: number,
    j: number,
    sourceSide: 'left' | 'right',
    targetSide: 'left' | 'right',
  ) => void;
  i: number;
  repoRef?: string;
  path?: string;
  title?: string;
  branch?: string | null;
  scrollToLine?: string;
  tokenRange?: string;
  focusedPanel: 'left' | 'right';
  isTemp?: boolean;
  studioId?: string;
  initialRanges?: [number, number][];
  isFileInContext?: boolean;
  conversationId?: string;
  initialQuery?: {
    path: string;
    lines: [number, number];
    repoRef: string;
    branch?: string | null | undefined;
  };
  docId?: string;
  favicon?: string;
  relativeUrl?: string;
};

const closeTabShortcut = ['cmd', 'W'];

const TabButton = ({
  isActive,
  tabKey,
  repoRef,
  path,
  type,
  title,
  side,
  moveTab,
  isOnlyTab,
  i,
  branch,
  scrollToLine,
  tokenRange,
  focusedPanel,
  isTemp,
  studioId,
  initialRanges,
  isFileInContext,
  conversationId,
  initialQuery,
  relativeUrl,
  favicon,
  docId,
}: Props) => {
  const { t } = useTranslation();
  const { closeTab, setActiveLeftTab, setActiveRightTab, setFocusedPanel } =
    useContext(TabsContext.Handlers);
  const ref = useRef<HTMLAnchorElement>(null);
  const [{ handlerId }, drop] = useDrop({
    accept: [`tab-left`, `tab-right`],
    canDrop: (item: DraggableTabItem) => true,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DraggableTabItem, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = i;
      const sourceSide = item.side as 'left' | 'right';
      const targetSide = side as 'left' | 'right';
      // Don't replace items with themselves
      if (dragIndex === hoverIndex && sourceSide === targetSide) {
        return;
      }
      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      // Get vertical middle
      const hoverMiddleX =
        (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      // Get pixels to the left
      const hoverClientX = (clientOffset?.x || 0) - hoverBoundingRect.left;
      // Only perform the move when the mouse has crossed half of the items width
      // When dragging left, only move when the cursor is below 50%
      // When dragging right, only move when the cursor is above 50%
      // Dragging left
      if (
        dragIndex < hoverIndex &&
        hoverClientX < hoverMiddleX &&
        sourceSide === targetSide
      ) {
        return;
      }
      // Dragging right
      if (
        dragIndex > hoverIndex &&
        hoverClientX > hoverMiddleX &&
        sourceSide === targetSide
      ) {
        return;
      }
      // Time to actually perform the action
      moveTab(dragIndex, hoverIndex, sourceSide, targetSide);
      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
      if (sourceSide !== targetSide) {
        item.side = targetSide;
      }
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
        t: {
          key: tabKey,
          repoRef: repoRef!,
          path: path!,
          type,
          title,
          branch,
          scrollToLine,
          tokenRange,
          studioId,
          initialRanges,
          isFileInContext,
          conversationId,
          initialQuery,
          favicon,
          relativeUrl,
          docId,
        },
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
    setAction({
      path,
      repoRef,
      key: tabKey,
      type,
      title,
      branch,
      scrollToLine,
      tokenRange,
      studioId,
      initialRanges,
      isFileInContext,
      conversationId,
      initialQuery,
      docId,
      relativeUrl,
      favicon,
    });
    setFocusedPanel(side);
  }, [
    path,
    repoRef,
    tabKey,
    side,
    branch,
    scrollToLine,
    tokenRange,
    title,
    studioId,
    initialRanges,
    isFileInContext,
    conversationId,
    initialQuery,
  ]);

  return (
    <a
      href="#"
      ref={ref}
      onClick={handleClick}
      className={`flex h-7 w-[9rem] gap-1.5 pl-2 pr-1.5 ${
        isDragging
          ? 'opacity-0 border border-bg-border-selected bg-bg-selected'
          : 'opacity-100'
      } flex-shrink-0 items-center rounded ellipsis group ${
        isActive
          ? focusedPanel === side
            ? 'bg-bg-base-hover'
            : 'bg-bg-base'
          : ''
      } hover:bg-bg-base-hover transition duration-75 ease-in-out select-none`}
      data-handler-id={handlerId}
    >
      {type === TabTypesEnum.FILE ? (
        <FileIcon filename={path} noMargin />
      ) : type === TabTypesEnum.CHAT ? (
        <ChatBubblesIcon
          sizeClassName="w-4 h-4"
          className="text-brand-default"
        />
      ) : type === TabTypesEnum.STUDIO ? (
        <CodeStudioIcon sizeClassName="w-4 h-4" className="text-brand-studio" />
      ) : favicon ? (
        <img src={favicon} className="w-4 h-4" alt={title} />
      ) : (
        <MagazineIcon sizeClassName="w-4 h-4" />
      )}
      <p
        className={`body-mini-b ellipsis group-hover:text-label-title flex-1 ${
          isActive ? 'text-label-title' : 'text-label-muted'
        } ${isTemp ? '!italic' : ''} transition duration-75 ease-in-out`}
      >
        {type === TabTypesEnum.FILE
          ? splitPath(path).pop()
          : type === TabTypesEnum.CHAT
          ? title || t('New chat')
          : type === TabTypesEnum.STUDIO
          ? title || t('New studio conversation')
          : title || relativeUrl}
      </p>
      <Button
        variant="ghost"
        size="mini"
        onlyIcon
        title={t('Close tab')}
        shortcut={isActive ? closeTabShortcut : undefined}
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
