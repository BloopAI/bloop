import { useMemo, useState } from 'react';
import ContextMenu, { ContextMenuItem } from '../ContextMenu';
import { MenuItemType } from '../../types/general';
import { MoreHorizontal } from '../../icons';
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
  const contextMenuItems = useMemo(
    () =>
      items.map(
        (part): ContextMenuItem => ({
          icon: part.icon,
          text: part.label,
          onClick: part?.onClick,
          type: MenuItemType.LINK,
          underline: part.underline,
        }),
      ),
    [items],
  );
  return (
    <span className="relative">
      <ContextMenu
        items={contextMenuItems}
        visible={isHiddenClicked}
        handleClose={() => setIsHiddenClicked(false)}
        appendTo={document.body}
      >
        <span>
          <button
            className={`p-0 outline-0 outline-none focus:outline-none border-0 flex items-center ${
              isHiddenClicked
                ? typeMap[type].isHiddenClicked
                : typeMap[type].default
            }`}
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsHiddenClicked(() => !isHiddenClicked);
            }}
          >
            <MoreHorizontal />
          </button>
        </span>
      </ContextMenu>
    </span>
  );
};

export default BreadcrumbsCollapsed;
