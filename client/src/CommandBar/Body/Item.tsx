import {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { CommandBarItemType, CommandBarStepType } from '../../types/general';
import useShortcuts from '../../hooks/useShortcuts';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';
import { checkEventKeys } from '../../utils/keyboardUtils';

type Props = CommandBarItemType & {
  isFocused?: boolean;
  setFocusedItem: Dispatch<SetStateAction<CommandBarItemType | null>>;
  i: number;
  isFirst?: boolean;
  setFocusedIndex: Dispatch<SetStateAction<number>>;
  setActiveStep: Dispatch<SetStateAction<CommandBarStepType>>;
};

const CommandBarItem = ({
  isFocused,
  Icon,
  label,
  shortcut,
  setFocusedItem,
  i,
  setFocusedIndex,
  setActiveStep,
  id,
  parent,
  footerBtns,
  isFirst,
  iconContainerClassName,
  ...rest
}: Props) => {
  const ref = useRef<HTMLButtonElement>(null);
  const shortcutKeys = useShortcuts(shortcut);

  useEffect(() => {
    if (isFocused) {
      setFocusedItem({
        ...rest,
        Icon,
        label,
        shortcut,
        footerBtns,
        id,
        iconContainerClassName,
      });
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const handleMouseOver = useCallback(() => {
    setFocusedIndex(i);
  }, [i, setFocusedIndex]);

  const handleClick = useCallback(() => {
    setActiveStep({ id, label, parent });
  }, [id, label, parent]);

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
    </button>
  );
};

export default memo(CommandBarItem);
