import { memo, ReactElement, useCallback, useEffect, useRef } from 'react';
import { CheckIcon } from '../../../icons';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useShortcuts from '../../../hooks/useShortcuts';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { isFocusInInput } from '../../../utils/domUtils';

type Props = {
  icon?: ReactElement;
  label: string;
  shortcut?: string[];
  isSelected?: boolean;
  isFocused?: boolean;
  onClick: () => void;
  color?: 'shade' | 'base';
};

const SectionItem = ({
  icon,
  label,
  shortcut,
  onClick,
  isSelected,
  isFocused,
  color = 'shade',
}: Props) => {
  const shortcutKeys = useShortcuts(shortcut);
  const ref = useRef<HTMLButtonElement>(null);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (!isFocusInInput(true)) {
        if (checkEventKeys(e, shortcut)) {
          e.preventDefault();
          e.stopPropagation();
          onClick();
          return;
        }
      }
    },
    [shortcut],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <button
      onClick={onClick}
      ref={ref}
      className={`w-full text-left rounded-6 h-8 flex items-center px-2 gap-2
        hover:text-label-title ${
          color === 'shade'
            ? 'hover:bg-bg-shade-hover'
            : 'hover:bg-bg-base-hover'
        } ${
          isFocused
            ? `text-label-title ${
                color === 'shade' ? 'bg-bg-shade-hover' : 'bg-bg-base-hover'
              }`
            : `text-label-muted ${
                color === 'shade' ? 'bg-bg-shade' : 'bg-bg-base'
              }`
        } focus:outline-0 focus:outline-none`}
    >
      {icon}
      <p className="flex-1 body-s-b text-label-title ellisis">{label}</p>
      <p className="body-mini-b text-label-muted">{shortcutKeys?.join(' ')}</p>
      {isSelected && (
        <CheckIcon
          sizeClassName="w-4 h-4"
          className="text-bg-border-selected"
        />
      )}
    </button>
  );
};

export default memo(SectionItem);
