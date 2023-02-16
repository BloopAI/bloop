import { useMemo, useState } from 'react';
import ContextMenu from '../ContextMenu';
import { MenuItemType } from '../../types/general';
import { PathParts } from './index';

type Props = {
  items: PathParts[];
};

const BreadcrumbsCollapsed = ({ items }: Props) => {
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
            className={`bg-none p-0 outline-0 outline-none focus:outline-none border-0 ${
              isHiddenClicked ? 'text-gray-200' : 'text-gray-500'
            } hover:text-sky-500 active:text-sky-500`}
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsHiddenClicked(() => !isHiddenClicked);
            }}
          >
            ...
          </button>
        </span>
      </ContextMenu>
    </span>
  );
};

export default BreadcrumbsCollapsed;
