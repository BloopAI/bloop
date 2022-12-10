import FileItem from './FileItem';

export type FileItemType = {
  name: string;
  children?: FileItemType[];
};

type Props = {
  items: FileItemType[];
};

const FileTree = ({ items }: Props) => {
  return (
    <>
      {items.map((item) => (
        <FileItem
          key={item.name}
          item={item}
          level={0}
          expand={false}
          handleClick={null}
        />
      ))}
    </>
  );
};
export default FileTree;
