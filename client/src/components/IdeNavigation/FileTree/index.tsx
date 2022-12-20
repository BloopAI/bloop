import { FileTreeFileType } from '../../../types';
import { FileTreeItem } from '../../../types/results';
import FileItem from './FileItem';

type Props = {
  items: FileTreeItem[];
  currentPath: string;
  onFileClick: (p: string, type: FileTreeFileType) => void;
};

const FileTree = ({ items, currentPath, onFileClick }: Props) => {
  return (
    <>
      {items.map((item) => (
        <FileItem
          key={item.name}
          item={item}
          level={0}
          expand={false}
          handleClick={onFileClick}
          currentPath={currentPath + item.name}
        />
      ))}
    </>
  );
};
export default FileTree;
