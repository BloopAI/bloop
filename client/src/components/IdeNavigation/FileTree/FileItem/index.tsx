import FileIcon from '../../../FileIcon';
import NavigationItem from '../../NavigationItem';
import { FileTreeFileType } from '../../../../types';
import { FolderFilled } from '../../../../icons';
import { DirectoryEntry } from '../../../../types/api';

export type Props = {
  item: DirectoryEntry;
  level: number;
  handleClick: (p: string, type: FileTreeFileType) => void;
  currentPath: string;
};

const FileItem = ({ item, level, handleClick, currentPath }: Props) => {
  return (
    <div
      className={`flex items-center hover:text-label-title hover:bg-bg-base-hover cursor-pointer ${
        !item ? 'bg-bg-shade text-label-title' : 'bg-bg-base text-label-base'
      }`}
      style={{ paddingLeft: `${level ? level + 0.7 * level : level}rem` }}
    >
      {item.entry_data === 'Directory' ? (
        <NavigationItem
          icon={<FolderFilled />}
          value={item.name}
          variant={'default'}
          onClick={() => {
            handleClick(`${currentPath}/`, FileTreeFileType.DIR);
          }}
        />
      ) : (
        <NavigationItem
          icon={<FileIcon filename={item.name} />}
          value={item.name}
          variant={'default'}
          active={item.selected}
          onClick={() => {
            handleClick(currentPath, FileTreeFileType.FILE);
          }}
        />
      )}
    </div>
  );
};

export default FileItem;
