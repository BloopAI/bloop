// @ts-ignore
import * as icons from 'file-icons-js';
import { useMemo } from 'react';
type Props = { filename: string; noMargin?: boolean };

const FileIcon = ({ filename, noMargin }: Props) => {
  const iconClassName = useMemo(() => {
    try {
      return (
        icons.getClassWithColor(filename) || icons.getClassWithColor('.txt')
      );
    } catch (err) {
      console.log(err);
      return 'text-icon medium-blue';
    }
  }, [filename]);
  return (
    <span
      className={`text-left w-4 h-4 ${
        noMargin ? '' : 'mr-1'
      } file-icon flex items-center flex-shrink-0 ${iconClassName} `}
    />
  );
};

export default FileIcon;
