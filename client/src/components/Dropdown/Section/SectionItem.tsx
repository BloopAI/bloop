import {
  memo,
  ReactElement,
  useCallback,
  MouseEvent,
  useRef,
  useEffect,
} from 'react';
import { CheckIcon } from '../../../icons';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useShortcuts from '../../../hooks/useShortcuts';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { isFocusInInput } from '../../../utils/domUtils';

type Props = {
  icon?: ReactElement;
  customRightElement?: ReactElement;
  label: string | ReactElement;
  description?: string | ReactElement;
  shortcut?: string[];
  isSelected?: boolean;
  isFocused?: boolean;
  onClick?: (e?: MouseEvent) => void;
  color?: 'shade' | 'base';
};

const SectionItem = ({
  icon,
  label,
  description,
  shortcut,
  onClick,
  isSelected,
  isFocused,
  color = 'shade',
  customRightElement,
}: Props) => {
  const shortcutKeys = useShortcuts(shortcut);
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (!isFocusInInput(true) && onClick) {
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
  useKeyboardNavigation(handleKeyEvent, !onClick);

  return (
    <a
      href="#"
      onClick={onClick}
      ref={ref}
      className={`w-full text-left rounded-6 ${
        description ? 'py-2' : 'h-8'
      } px-2 overflow-hidden
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
      <span className="flex items-center gap-2 h-full overflow-hidden">
        {icon}
        <span
          className="flex-1 flex flex-col gap-1 ellipsis"
          title={typeof label === 'string' ? label : undefined}
        >
          <span className="body-s text-label-title ellipsis">{label}</span>
          {!!description && (
            <span className="body-mini text-label-base">{description}</span>
          )}
        </span>
        {!!shortcutKeys && (
          <span className="body-mini-b text-label-muted">
            {shortcutKeys?.join(' ')}
          </span>
        )}
        {isSelected && (
          <CheckIcon
            sizeClassName="w-4 h-4"
            className="text-bg-border-selected"
          />
        )}
        {customRightElement}
      </span>
    </a>
  );
};

export default memo(SectionItem);
