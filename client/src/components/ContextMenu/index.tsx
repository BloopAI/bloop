import React, { MouseEvent, PropsWithChildren, useRef } from 'react';
import Tippy, { TippyProps } from '@tippyjs/react/headless';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import { ExtendedMenuItemType, MenuItemType } from '../../types/general';
import ItemShared from './ContextMenuItem/ItemShared';
import Item from './ContextMenuItem/Item';

export const MenuListItemType = { ...MenuItemType, ...ExtendedMenuItemType };

export type ContextMenuLinkItem = {
  type: MenuItemType.LINK;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  onMouseOver?: () => void;
  icon?: React.ReactElement;
  text?: string;
  href?: string;
  onDelete?: () => void;
  disabled?: boolean;
  tooltip?: string;
};

export type ContextMenuItem =
  | ContextMenuLinkItem
  | {
      icon?: React.ReactElement;
      text?: string | React.ReactElement;
      type: MenuItemType | ExtendedMenuItemType;
      onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
      onMouseOver?: () => void;
      annotations?: number;
      removable?: boolean;
      onDelete?: () => void;
      disabled?: boolean;
      tooltip?: string;
    };

type Props = {
  items: ContextMenuItem[];
  visible: boolean;
  closeOnClickOutside?: boolean;
  lastItemFixed?: boolean;
  title?: string;
  handleClose: () => void;
  key?: string;
  appendTo?: Element | 'parent';
  size?: 'small' | 'medium' | 'large';
  dropdownPlacement?: TippyProps['placement'];
};

const sizesMap = {
  small: 'w-44',
  medium: 'w-72',
  large: 'w-100',
};

const ContextMenu = ({
  items,
  title,
  visible,
  handleClose,
  children,
  closeOnClickOutside = true,
  appendTo = 'parent',
  lastItemFixed,
  size = 'medium',
  dropdownPlacement = 'bottom-start',
}: PropsWithChildren<Props>) => {
  const contextMenuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(
    contextMenuRef,
    closeOnClickOutside ? handleClose : () => {},
  );

  const renderItem = (item: ContextMenuItem, i: number) => {
    switch (item.type) {
      case MenuItemType.DEFAULT:
      case MenuItemType.LINK:
      case MenuItemType.DANGER:
      case MenuItemType.REMOVABLE:
      case MenuItemType.SELECTABLE:
        return (
          <Item
            key={i}
            icon={item.icon}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick?.(e);
              handleClose();
            }}
            onMouseOver={item.onMouseOver}
            text={item.text!}
            type={item.type}
            onDelete={item.onDelete}
            disabled={item.disabled}
            tooltip={item.tooltip}
          />
        );
      case ExtendedMenuItemType.DIVIDER:
        return <span className="bg-bg-border h-[1px] w-full" key={i} />;
      case ExtendedMenuItemType.DIVIDER_WITH_TEXT:
        return (
          <div
            className="px-2.5 py-2 border-b border-bg-border caption text-label-base sticky top-0 bg-bg-shade"
            key={i}
          >
            {item.text}
          </div>
        );
      case ExtendedMenuItemType.SHARED:
        return (
          <ItemShared
            key={i}
            text={item.text!}
            annotations={item.annotations!}
            icon={item.icon}
            onClick={item.onClick}
            removable={item.removable}
            onDelete={item.onDelete}
          />
        );
    }
  };

  return (
    <Tippy
      onHide={handleClose}
      visible={visible}
      placement={dropdownPlacement}
      interactive
      key={title}
      appendTo={appendTo}
      render={() => (
        <div
          id="dropdown"
          ref={contextMenuRef}
          className={`${visible ? '' : 'scale-0 opacity-0'}
      transition-all duration-300 ease-in-slow max-h-96 overflow-auto
       rounded-md p-1 bg-bg-shade border border-bg-border shadow-high ${
         sizesMap[size]
       } flex flex-col gap-1`}
        >
          {title ? (
            <>
              <span className="text-label-base text-xs px-2.5 pt-2 block ">
                {title}
              </span>
              <div className="bg-bg-border-hover h-[1px] w-full" />
            </>
          ) : (
            ''
          )}
          {lastItemFixed ? (
            <div>
              <div className="overflow-auto max-h-96">
                {items.slice(0, -1).map(renderItem)}
              </div>
              {renderItem(items[items.length - 1], items.length - 1)}
            </div>
          ) : (
            items.map(renderItem)
          )}
        </div>
      )}
    >
      <span>{children}</span>
    </Tippy>
  );
};
export default ContextMenu;
