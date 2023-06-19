// @ts-ignore
import * as icons from 'file-icons-js';
type Props = { filename: string; noMargin?: boolean };

const FileIcon = ({ filename, noMargin }: Props) => {
  return (
    <span
      className={`text-left w-4 h-4 ${
        noMargin ? '' : 'mr-1'
      } file-icon flex items-center flex-shrink-0 ${
        icons.getClassWithColor(filename) || icons.getClassWithColor('.txt')
      } `}
    />
  );
};

export default FileIcon;
