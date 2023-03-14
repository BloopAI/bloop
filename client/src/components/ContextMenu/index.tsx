import React, { MouseEvent, PropsWithChildren, useRef } from 'react';
import Tippy from '@tippyjs/react/headless';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import { ExtendedMenuItemType, MenuItemType } from '../../types/general';
import ItemShared from './ContextMenuItem/ItemShared';
import Item from './ContextMenuItem/Item';

export const MenuListItemType = { ...MenuItemType, ...ExtendedMenuItemType };

export type ContextMenuLinkItem = {
  type: MenuItemType.LINK;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  icon?: React.ReactElement;
  text?: string;
  href?: string;
  onDelete?: () => void;
  disabled?: boolean;
  tooltip?: string;
  btnId?: string;
};

export type ContextMenuItem =
  | ContextMenuLinkItem
  | {
      icon?: React.ReactElement;
      text?: string;
      type: MenuItemType | ExtendedMenuItemType;
      onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
      annotations?: number;
      removable?: boolean;
      onDelete?: () => void;
      disabled?: boolean;
      tooltip?: string;
      btnId?: string;
    };

type Props = {
  items: ContextMenuItem[];
  visible: boolean;
  closeOnClickOutside?: boolean;
  title?: string;
  handleClose: () => void;
  key?: string;
  appendTo?: Element | 'parent';
};

const ContextMenu = ({
  items,
  title,
  visible,
  handleClose,
  children,
  closeOnClickOutside = true,
  appendTo = 'parent',
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
            key={item.text! + i}
            icon={item.icon}
            onClick={(e) => {
              item.onClick?.(e);
              handleClose();
            }}
            text={item.text!}
            type={item.type}
            onDelete={item.onDelete}
            disabled={item.disabled}
            tooltip={item.tooltip}
            btnId={item.btnId}
          />
        );
      case ExtendedMenuItemType.DIVIDER:
        return <span className="bg-gray-700 h-[1px] w-full" key={i} />;
      case ExtendedMenuItemType.SHARED:
        return (
          <ItemShared
            key={item.text! + i}
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
      placement="bottom-start"
      interactive
      key={title}
      appendTo={appendTo}
      render={() => (
        <div
          id="dropdown"
          ref={contextMenuRef}
          className={`${visible ? '' : 'scale-0 opacity-0'}
      transition-all duration-300 ease-in-slow backdrop-blur-6
       rounded p-1 bg-gray-800/75 shadow-light-bigger w-72 flex flex-col gap-1`}
        >
          {title ? (
            <>
              <span className="text-gray-300 text-xs px-2.5 pt-2 block ">
                {title}
              </span>
              <div className="bg-gray-700 h-[1px] w-full" />
            </>
          ) : (
            ''
          )}
          {items.map(renderItem)}
        </div>
      )}
    >
      <span>{children}</span>
    </Tippy>
  );
};
export default ContextMenu;
