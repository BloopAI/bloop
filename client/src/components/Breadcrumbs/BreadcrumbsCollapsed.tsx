import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import Tippy from '@tippyjs/react/headless';
import { MoreHorizontalIcon } from '../../icons';
import { animationDuration } from '../Dropdown';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import DropdownSection from '../Dropdown/Section';
import SectionItem from '../Dropdown/Section/SectionItem';
import { PathParts } from './index';

type Props = {
  items: PathParts[];
  type: 'link' | 'button';
};

const typeMap = {
  link: {
    default: 'bg-none text-label-muted hover:text-bg-main active:text-bg-main',
    isHiddenClicked: 'text-label-title hover:text-bg-main active:text-bg-main',
  },
  button: {
    default:
      'px-2 py-1 rounded-4 hover:bg-bg-base-hover text-label-base hover:text-label-title',
    isHiddenClicked: 'text-label-title bg-bg-base-hover px-2 py-1 rounded-4',
  },
};

const BreadcrumbsCollapsed = ({ items, type }: Props) => {
  const [isHiddenClicked, setIsHiddenClicked] = useState(false);
  const contextMenuRef = useRef(null);
  const buttonRef = useRef(null);

  const handleClose = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setIsHiddenClicked(false);
  }, []);
  useOnClickOutside(contextMenuRef, handleClose, buttonRef);

  const handleToggle = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsHiddenClicked((prev) => !prev);
  }, []);

  useEffect(() => {
    return () => {
      setIsHiddenClicked(false);
    };
  }, []);

  const renderContent = useCallback(() => {
    return isHiddenClicked ? (
      <div className="bg-bg-shade p-1 rounded">
        <DropdownSection>
          {items.map((part, i) => (
            <SectionItem
              key={i}
              onClick={part?.onClick}
              label={part.label}
              icon={part.icon}
            />
          ))}
        </DropdownSection>
      </div>
    ) : null;
  }, [isHiddenClicked]);

  const noPropagate = useCallback(
    (e?: React.MouseEvent) => e?.stopPropagation(),
    [],
  );

  return (
    <span className="relative" onClick={noPropagate} ref={contextMenuRef}>
      <Tippy
        visible={isHiddenClicked}
        interactive
        appendTo={document.body}
        duration={animationDuration}
        animation
        render={renderContent}
      >
        <span>
          <button
            ref={buttonRef}
            className={`p-0 outline-0 outline-none focus:outline-none border-0 flex items-center ${
              isHiddenClicked
                ? typeMap[type].isHiddenClicked
                : typeMap[type].default
            }`}
            onClick={handleToggle}
          >
            <MoreHorizontalIcon sizeClassName="w-3.5 h-3.5" />
          </button>
        </span>
      </Tippy>
    </span>
  );
};

export default memo(BreadcrumbsCollapsed);
