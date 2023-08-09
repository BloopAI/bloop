import { memo, useCallback, useEffect, useState } from 'react';
import { ChevronRightFilled, FolderClosed } from '../../icons';
import FileIcon from '../FileIcon';
import { DirectoryEntry } from '../../types/api';

type Props = {
  name: string;
  isDirectory: boolean;
  level: number;
  currentPath: string;
  fullPath: string;
  fetchFiles: (path: string) => Promise<DirectoryEntry[]>;
  navigateToPath: (path: string) => void;
  defaultOpen?: boolean;
};

const DirEntry = ({
  name,
  level,
  isDirectory,
  currentPath,
  fullPath,
  fetchFiles,
  navigateToPath,
  defaultOpen,
}: Props) => {
  const [isOpen, setOpen] = useState(
    defaultOpen || (currentPath && name.includes(currentPath)),
  );
  const [subItems, setSubItems] = useState<DirectoryEntry[] | null>(null);

  useEffect(() => {
    if (currentPath && currentPath.includes(name)) {
      setOpen(true);
    }
  }, [currentPath, name]);

  useEffect(() => {
    if (isDirectory && isOpen && !subItems) {
      fetchFiles(fullPath).then(setSubItems);
    }
  }, [isOpen, isDirectory, subItems, fullPath]);

  const handleClick = useCallback(() => {
    if (isDirectory) {
      setOpen((prev) => !prev);
    } else {
      navigateToPath(fullPath);
    }
  }, [isDirectory, fullPath, navigateToPath]);

  return (
    <div
      style={{
        maxHeight: isOpen && subItems ? undefined : 28,
      }}
      className="flex flex-col transition-all ease-linear overflow-hidden flex-shrink-0 w-full min-w-fit"
    >
      <button
        className={`min-w-full w-max text-left h-7 flex items-center gap-1.5 py-2 px-3 cursor-pointer caption 
      ${
        currentPath === fullPath
          ? 'bg-bg-shade'
          : 'hover:bg-bg-base-hover hover:text-label-title active:bg-transparent'
      } ${isOpen && isDirectory ? 'text-label-title' : 'text-label-base'}`}
        style={{ paddingLeft: level * 26 }}
        onClick={handleClick}
      >
        {isDirectory ? (
          <ChevronRightFilled
            className={`${
              isOpen ? 'transform rotate-90' : ''
            } transition-all duration-200`}
          />
        ) : null}
        {isDirectory ? (
          <FolderClosed raw sizeClassName="w-4 h-4" />
        ) : (
          <FileIcon filename={name} />
        )}
        {isDirectory ? name.slice(0, -1) : name}
      </button>
      {subItems?.length ? (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 left-2 w-px bg-bg-border"
            style={{ left: level * 26 + 10 }}
          />
          {subItems.map((si) => (
            <DirEntry
              key={name + si.name}
              name={si.name}
              isDirectory={si.entry_data === 'Directory'}
              level={level + 1}
              currentPath={currentPath}
              fetchFiles={fetchFiles}
              fullPath={fullPath + si.name}
              navigateToPath={navigateToPath}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default memo(DirEntry);
