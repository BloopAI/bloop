import React, {
  memo,
  PropsWithChildren,
  ReactElement,
  useCallback,
  useRef,
  useState,
} from 'react';
import Tippy, { TippyProps } from '@tippyjs/react';
import { useArrowKeyNavigation } from '../../hooks/useArrowNavigationHook';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';

type Props = {
  dropdownPlacement?: TippyProps['placement'];
  appendTo?: TippyProps['appendTo'];
  size?: 'small' | 'medium' | 'large';
  dropdownItems: ReactElement;
};

const sizesMap = {
  small: 'w-44',
  medium: 'w-72',
  large: 'w-100',
};

const Dropdown = ({
  children,
  dropdownPlacement = 'bottom-start',
  appendTo = 'parent',
  size = 'medium',
  dropdownItems,
}: PropsWithChildren<Props>) => {
  const [isVisible, setIsVisible] = useState(false);
  const contextMenuRef = useArrowKeyNavigation({ selectors: 'button' });
  const buttonRef = useRef(null);

  const handleClose = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
  }, []);
  useOnClickOutside(contextMenuRef, handleClose, buttonRef);

  const handleToggle = useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  const renderContent = useCallback(() => {
    return (
      <div
        id="dropdown"
        ref={appendTo !== 'parent' ? contextMenuRef : null}
        className={`${isVisible ? '' : 'scale-0 opacity-0'} ${
          dropdownPlacement?.endsWith('-end')
            ? 'origin-top-right'
            : 'origin-left'
        } max-h-96 overflow-auto
       rounded-md border border-bg-border bg-bg-shade shadow-high ${
         sizesMap[size]
       } flex flex-col gap-1 select-none`}
        onClick={handleClose}
      >
        {dropdownItems}
      </div>
    );
  }, [dropdownItems, isVisible, dropdownPlacement]);

  return (
    <div ref={appendTo === 'parent' ? contextMenuRef : null}>
      <Tippy
        visible={isVisible}
        placement={dropdownPlacement}
        interactive
        appendTo={appendTo}
        render={renderContent}
        disabled={!isVisible}
      >
        <span>
          <button onClick={handleToggle} className="flex" ref={buttonRef}>
            {children}
          </button>
        </span>
      </Tippy>
    </div>
  );
};

export default memo(Dropdown);

export { default as DropdownNormal } from './Normal';
export { default as DropdownWithIcon } from './WithIcon';
