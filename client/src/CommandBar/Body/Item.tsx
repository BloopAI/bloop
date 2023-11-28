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

type Props = CommandBarItemGeneralType & {
  isFocused?: boolean;
  i: number;
  isFirst?: boolean;
  setFocusedIndex: Dispatch<SetStateAction<number>>;
  customRightElement?: ReactElement;
  onClick?: () => void;
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
}: Props) => {
  const ref = useRef<HTMLButtonElement>(null);
  const shortcutKeys = useShortcuts(shortcut);
  const { setFocusedItem, setChosenStep } = useContext(
    CommandBarContext.Handlers,
  );

  useEffect(() => {
    if (isFocused) {
      setFocusedItem({
        footerHint,
        footerBtns,
      });
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused, footerBtns, footerHint]);

  const handleMouseOver = useCallback(() => {
    setFocusedIndex(i);
  }, [i, setFocusedIndex]);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else {
      setChosenStep({ id: id as CommandBarStepEnum });
    }
  }, [id, onClick]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      const shortAction = footerBtns.find((b) => checkEventKeys(e, b.shortcut));
      if (
        (isFocused && shortAction && !shortAction.action) ||
        checkEventKeys(e, shortcut)
      ) {
        handleClick();
        return;
      }
      if (isFocused && shortAction?.action) {
        shortAction.action();
      }
    },
    [isFocused, shortcut, footerBtns, handleClick],
  );
  useKeyboardNavigation(handleKeyEvent);

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
        className={`rounded-6 w-6 h-6 flex items-center justify-center ${
          iconContainerClassName || 'bg-bg-border'
        }`}
      >
        <Icon sizeClassName="w-3.5 h-3.5" />
      </div>
      <p className="flex-1 body-s">{label}</p>
      {!!shortcutKeys && (
        <div className="flex items-center gap-1">
          {shortcutKeys.map((k) => (
            <div
              key={k}
              className={`w-5 h-5 px-1 flex-shrink-0 flex items-center justify-center rounded 
              border border-bg-border bg-bg-base shadow-low body-mini text-label-base`}
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
