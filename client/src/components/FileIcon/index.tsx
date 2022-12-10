import '../../file-icons.css';

// @ts-ignore
import * as icons from 'file-icons-js';
type Props = { filename: string };

const FileIcon = ({ filename }: Props) => {
  return (
    <span
      className={`text-left w-4 mr-1 file-icon ${
        icons.getClassWithColor(filename) || icons.getClassWithColor('.txt')
      } `}
    />
  );
};

export default FileIcon;
