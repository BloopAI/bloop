import React, { useEffect, useState } from 'react';
import FileIcon from '../../../FileIcon';
import NavigationItem from '../../NavigationItem';
import NavigationItemChevron from '../../NavigationItemChevron';
import { FileItemType } from '../index';

export type Props = {
  item: FileItemType;
  level: number;
  handleClick: any;
  expand: boolean;
};

const FileItem = ({ item, level, handleClick, expand }: Props) => {
  const [selected, setSelected] = useState<boolean>(expand);
  const [clicked, setClicked] = useState(false);
  const hasChildren = item.children && item.children.length !== 0;

  useEffect(() => {
    setSelected(expand);
  }, [expand]);

  const renderBranches = () => {
    if (hasChildren) {
      const newLevel = level + 1;

      return item.children?.map((child: any) => {
        return (
          <FileItem
            item={child}
            level={newLevel}
            handleClick={handleClick}
            expand={expand}
            key={child.name}
          />
        );
      });
    }

    return null;
  };

  const toggleSelected = () => {
    setSelected((prev: boolean) => !prev);
  };

  return (
    <>
      <div
        className={`flex items-center hover:text-gray-300 hover:bg-gray-800 cursor-pointer ${
          clicked && !hasChildren
            ? 'bg-gray-800 text-gray-300'
            : 'bg-gray-900 text-gray-500'
        }`}
        onClick={() => setClicked(!clicked)}
        style={{ paddingLeft: `${level ? level + 0.7 * level : level}rem` }}
      >
        {hasChildren ? (
          <NavigationItemChevron
            active={selected}
            onClick={toggleSelected}
            value={item.name}
          />
        ) : (
          <NavigationItem
            icon={<FileIcon filename={item.name} />}
            value={item.name}
            active={clicked}
            variant={'default'}
          />
        )}
      </div>
      <span
        className={`transition-all ease-in-out duration-300 block overflow-hidden ${
          selected ? 'max-h-96 pb-1' : 'max-h-0 pb-0'
        }`}
      >
        {renderBranches()}
      </span>
    </>
  );
};

export default FileItem;
