import {
  Dispatch,
  memo,
  ReactElement,
  SetStateAction,
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

type Props = CommandBarItemGeneralType & {
  isFocused?: boolean;
  i: number;
  isFirst?: boolean;
  isWithCheckmark?: boolean;
  setFocusedIndex: Dispatch<SetStateAction<number>>;
  customRightElement?: ReactElement;
  focusedItemProps?: Record<string, any>;
  disableKeyNav?: boolean;
  itemKey: string;
};

const CommandBarItem = ({
  isFocused,
  Icon,
  label,
  shortcut,
  i,
  setFocusedIndex,
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

  useEffect(() => {
    if (isFocused) {
      setFocusedItem({
        footerHint,
        footerBtns,
        focusedItemProps,
      });
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused, footerBtns, footerHint, focusedItemProps]);

  const handleMouseOver = useCallback(() => {
    setFocusedIndex(i);
  }, [i, setFocusedIndex]);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
      if (closeOnClick) {
        setIsVisible(false);
        setChosenStep({ id: CommandBarStepEnum.INITIAL });
      }
    } else {
      setChosenStep({
        id: id as Exclude<
          CommandBarStepEnum,
          CommandBarStepEnum.ADD_FILE_TO_STUDIO
        >,
      });
    }
    updateArrayInStorage(RECENT_COMMANDS_KEY, itemKey);
  }, [id, onClick, closeOnClick, itemKey]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      const shortAction = footerBtns.find((b) => checkEventKeys(e, b.shortcut));
      if (
        (isFocused && shortAction && !shortAction.action) ||
        checkEventKeys(e, shortcut)
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleClick();
        return;
      }
      if (isFocused && shortAction?.action) {
        e.preventDefault();
        e.stopPropagation();
        shortAction.action();
      }
    },
    [isFocused, shortcut, footerBtns, handleClick],
  );
  useKeyboardNavigation(handleKeyEvent, disableKeyNav);

  return (
    <button
      className={`flex items-center gap-3 rounded-md px-2 h-10 ${
        isFocused ? 'bg-bg-base-hover text-label-title' : 'text-label-base'
      } text-left ${isFirst ? 'scroll-mt-8' : ''}`}
      onMouseOver={handleMouseOver}
      onClick={handleClick}
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
      <p className="flex-1 body-s-b">{label}</p>
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
