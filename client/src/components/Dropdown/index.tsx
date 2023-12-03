import React, {
  memo,
  PropsWithChildren,
  ReactElement,
  useCallback,
  useRef,
  useState,
} from 'react';
import Tippy, { TippyProps } from '@tippyjs/react/headless';
import { Placement } from 'tippy.js';
import { useArrowKeyNavigation } from '../../hooks/useArrowNavigationHook';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';

type Props = {
  dropdownPlacement?: TippyProps['placement'];
  appendTo?: TippyProps['appendTo'];
  size?: 'small' | 'medium' | 'large';
  dropdownItems: ReactElement;
  containerClassName?: string;
};

const sizesMap = {
  small: 'w-52',
  medium: 'w-72',
  large: 'w-100',
};

const transformOriginMap = {
  bottom: 'origin-top',
  'bottom-start': 'origin-top-left',
  'bottom-end': 'origin-top-right',
  auto: 'origin-center',
  'auto-start': 'origin-top-left',
  'auto-end': 'origin-top-right',
  top: 'origin-bottom',
  'top-start': 'origin-bottom-left',
  'top-end': 'origin-bottom-right',
  right: 'origin-left',
  'right-start': 'origin-top-left',
  'right-end': 'origin-bottom-left',
  left: 'origin-right',
  'left-start': 'origin-top-right',
  'left-end': 'origin-bottom-right',
};

const Dropdown = ({
  children,
  dropdownPlacement = 'bottom-start',
  appendTo = 'parent',
  size = 'medium',
  dropdownItems,
  containerClassName,
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

  const renderContent = useCallback(
    (attr: {
      'data-placement': Placement;
      'data-reference-hidden'?: string;
      'data-escaped'?: string;
    }) => {
      return (
        <div
          id="dropdown"
          ref={appendTo !== 'parent' ? contextMenuRef : null}
          className={`${isVisible ? '' : 'scale-0 opacity-0'} ${
            transformOriginMap[attr['data-placement']]
          } max-h-96 overflow-auto transition-transform duration-150
       rounded-md border border-bg-border bg-bg-shade shadow-high ${
         sizesMap[size]
       } flex flex-col gap-1 select-none`}
          onClick={handleClose}
        >
          {dropdownItems}
        </div>
      );
    },
    [dropdownItems, isVisible, dropdownPlacement],
  );

  return (
    <div
      ref={appendTo === 'parent' ? contextMenuRef : null}
      className={containerClassName}
    >
      <Tippy
        visible={isVisible}
        placement={dropdownPlacement}
        interactive
        appendTo={appendTo}
        duration={[150, 200]}
        animation
        render={renderContent}
      >
        <span>
          <a
            onClick={handleToggle}
            className="flex cursor-pointer"
            ref={buttonRef}
          >
            {children}
          </a>
        </span>
      </Tippy>
    </div>
  );
};

export default memo(Dropdown);
