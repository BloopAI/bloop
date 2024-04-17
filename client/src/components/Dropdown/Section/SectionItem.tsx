import React, {
  memo,
  ReactElement,
  useCallback,
  MouseEvent,
  useRef,
  useEffect,
  useContext,
} from 'react';
import { CheckIcon } from '../../../icons';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useShortcuts from '../../../hooks/useShortcuts';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { ArrowNavigationContext } from '../../../context/arrowNavigationContext';

type Props = {
  icon?: ReactElement;
  customRightElement?: ReactElement;
  label: string | ReactElement;
  description?: string | ReactElement;
  shortcut?: string[];
  isSelected?: boolean;
  onClick?: (e?: MouseEvent) => void;
  color?: 'shade' | 'base';
  index: string;
  clickCallback?: () => void;
};

const SectionItem = ({
  icon,
  label,
  description,
  shortcut,
  onClick,
  isSelected,
  color = 'shade',
  customRightElement,
  index,
}: Props) => {
  const shortcutKeys = useShortcuts(shortcut);
  const ref = useRef<HTMLAnchorElement>(null);
  const { setFocusedIndex, focusedIndex, handleClose } = useContext(
    ArrowNavigationContext,
  );

  useEffect(() => {
    if (focusedIndex === index) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex === index]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (onClick) {
        if (checkEventKeys(e, shortcut) || checkEventKeys(e, ['entr'])) {
          e.preventDefault();
          e.stopPropagation();
          onClick();
          handleClose();
          return;
        }
      }
    },
    [shortcut, handleClose, onClick],
  );
  useKeyboardNavigation(handleKeyEvent, !onClick || focusedIndex !== index);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (e.movementX || e.movementY) {
        setFocusedIndex(index);
      }
    },
    [index, setFocusedIndex],
  );

  return (
    <a
      href="#"
      onClick={onClick}
      ref={ref}
      className={`w-full text-left rounded-6 ${
        description ? 'py-2' : 'h-8'
      } px-2 overflow-hidden ${
        focusedIndex === index
          ? `text-label-title ${
              color === 'shade' ? 'bg-bg-shade-hover' : 'bg-bg-base-hover'
            }`
          : `text-label-muted ${
              color === 'shade' ? 'bg-bg-shade' : 'bg-bg-base'
            }`
      } focus:outline-0 focus:outline-none`}
      data-node-index={index}
      onMouseMove={handleMouseMove}
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
