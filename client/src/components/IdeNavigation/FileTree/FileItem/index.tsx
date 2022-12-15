import FileIcon from '../../../FileIcon';
import NavigationItem from '../../NavigationItem';
import { FileTreeFileType } from '../../../../types';
import { FolderFilled } from '../../../../icons';
import { FileTreeItem } from '../../../../types/results';

export type Props = {
  item: FileTreeItem;
  level: number;
  handleClick: (p: string, type: FileTreeFileType) => void;
  expand: boolean;
  currentPath: string;
};

const FileItem = ({ item, level, handleClick, expand, currentPath }: Props) => {
  // const [selected, setSelected] = useState<boolean>(expand);
  const hasChildren =
    (item.children && item.children.length !== 0) ||
    item.type === FileTreeFileType.DIR;

  // useEffect(() => {
  //   setSelected(expand);
  // }, [expand]);
  // const isCurrentFile = useMemo(() => {
  //   return false;
  // }, [currentPath]);

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
            currentPath={currentPath + child.name}
          />
        );
      });
    }

    return null;
  };

  // const toggleSelected = () => {
  //   setSelected((prev: boolean) => !prev);
  // };

  return (
    <>
      <div
        className={`flex items-center hover:text-gray-300 hover:bg-gray-800 cursor-pointer ${
          item.selected && !hasChildren
            ? 'bg-gray-800 text-gray-300'
            : 'bg-gray-900 text-gray-500'
        }`}
        style={{ paddingLeft: `${level ? level + 0.7 * level : level}rem` }}
      >
        {hasChildren ? (
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
      <span
        className={`transition-all ease-in-out duration-300 block overflow-hidden`}
      >
        {renderBranches()}
      </span>
    </>
  );
};

export default FileItem;
