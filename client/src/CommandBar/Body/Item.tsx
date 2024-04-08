import React, {
  memo,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import {
  CommandBarItemGeneralType,
  CommandBarStepEnum,
} from '../../types/general';
import useShortcuts from '../../hooks/useShortcuts';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';
import { checkEventKeys } from '../../utils/keyboardUtils';
import { CommandBarContext } from '../../context/commandBarContext';
import { CheckmarkInSquareIcon } from '../../icons';
import {
  RECENT_COMMANDS_KEY,
  updateArrayInStorage,
} from '../../services/storage';
import { ArrowNavigationContext } from '../../context/arrowNavigationContext';

type Props = CommandBarItemGeneralType & {
  index: string;
  isFirst?: boolean;
  isWithCheckmark?: boolean;
  customRightElement?: ReactElement;
  focusedItemProps?: Record<string, any>;
  disableKeyNav?: boolean;
  itemKey: string;
};

const CommandBarItem = ({
  Icon,
  label,
  shortcut,
  index,
  id,
  footerBtns,
  isFirst,
  iconContainerClassName,
  footerHint,
  customRightElement,
  onClick,
  focusedItemProps,
  disableKeyNav,
  isWithCheckmark,
  closeOnClick,
  itemKey,
}: Props) => {
  const ref = useRef<HTMLButtonElement>(null);
  const shortcutKeys = useShortcuts(shortcut);
  const { setFocusedItem, setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );
  const { setFocusedIndex, focusedIndex } = useContext(ArrowNavigationContext);

  useEffect(() => {
    if (focusedIndex === index) {
      setFocusedItem({
        footerHint,
        footerBtns,
        focusedItemProps,
      });
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, index, footerBtns, footerHint, focusedItemProps]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (e.movementX || e.movementY) {
        setFocusedIndex(index);
      }
    },
    [index, setFocusedIndex],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent | KeyboardEvent) => {
      if (onClick) {
        onClick(e);
        if (closeOnClick) {
          setIsVisible(false);
          setChosenStep({ id: CommandBarStepEnum.INITIAL });
        }
      } else {
        setChosenStep({
          id: id as Exclude<
            CommandBarStepEnum,
            CommandBarStepEnum.ADD_TO_STUDIO | CommandBarStepEnum.SEARCH_DOCS
          >,
        });
      }
      updateArrayInStorage(RECENT_COMMANDS_KEY, itemKey);
    },
    [id, onClick, closeOnClick, itemKey],
  );

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      const shortAction = footerBtns.find((b) => checkEventKeys(e, b.shortcut));
      if (
        (focusedIndex === index && shortAction && !shortAction.action) ||
        checkEventKeys(e, shortcut)
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleClick(e);
        return;
      }
      if (focusedIndex === index && shortAction?.action) {
        e.preventDefault();
        e.stopPropagation();
        shortAction.action();
      }
    },
    [focusedIndex === index, shortcut, footerBtns, handleClick],
  );
  useKeyboardNavigation(handleKeyEvent, disableKeyNav);

  return (
    <button
      className={`flex items-center gap-3 rounded-md px-2 h-10 ${
        focusedIndex === index
          ? 'bg-bg-base-hover text-label-title'
          : 'text-label-base'
      } text-left ${isFirst ? 'scroll-mt-8' : ''}`}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      data-node-index={index}
      ref={ref}
    >
      <div
        className={`rounded-6 w-6 h-6 flex items-center justify-center relative ${
          iconContainerClassName || 'bg-bg-border'
        }`}
      >
        <Icon sizeClassName="w-3.5 h-3.5" />
        {isWithCheckmark && (
          <CheckmarkInSquareIcon
            sizeClassName="w-4 h-4"
            className="text-blue bg-bg-base absolute -bottom-1.5 -right-1.5 z-10"
          />
        )}
      </div>
      <p className="flex-1 body-s-b ellipsis">{label}</p>
      {!!shortcutKeys && (
        <div className="flex items-center gap-1">
          {shortcutKeys.map((k) => (
            <div
              key={k}
              className={`min-w-5 h-5 px-1 flex-shrink-0 flex items-center justify-center rounded 
              border border-bg-border bg-bg-base shadow-low body-mini-b text-label-base`}
            >
              {k}
            </div>
          ))}
        </div>
      )}
      {customRightElement}
    </button>
  );
};

export default memo(CommandBarItem);
