import { useMemo, useState } from 'react';
import ContextMenu from '../ContextMenu';
import { MenuItemType } from '../../types/general';
import { MoreHorizontal } from '../../icons';
import { PathParts } from './index';

type Props = {
  items: PathParts[];
  type: 'link' | 'button';
};

const typeMap = {
  link: {
    default: 'bg-none text-gray-500 hover:text-sky-500 active:text-sky-500',
    isHiddenClicked: 'text-gray-200 hover:text-sky-500 active:text-sky-500',
  },
  button: {
    default:
      'px-2 py-1 rounded-4 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-100',
    isHiddenClicked: 'text-gray-100 bg-gray-700 px-2 py-1 rounded-4',
  },
};

const BreadcrumbsCollapsed = ({ items, type }: Props) => {
  const [isHiddenClicked, setIsHiddenClicked] = useState(false);
  const contextMenuItems = useMemo(
    () =>
      items.map((part) => ({
        icon: part.icon,
        text: part.label,
        onClick: part?.onClick,
        type: MenuItemType.LINK,
      })),
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
