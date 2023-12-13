import { useMemo } from 'react';
import { FolderIcon } from '../../../../../icons';
import FileIcon from '../../../../../components/FileIcon';
import { splitPath } from '../../../../../utils';

type Props = {
  path: string;
};

const PathChip = ({ path }: Props) => {
  const isFolder = useMemo(() => path.endsWith('/'), [path]);
  return (
    <span
      className={`inline-flex items-center bg-bg-base rounded-4 overflow-hidden 
                text-label-title align-middle h-6`}
    >
      <span className="flex gap-1 px-1 py-0.5 items-center code-s">
        {isFolder ? (
          <FolderIcon raw sizeClassName="w-3.5 h-3.5" />
        ) : (
          <FileIcon filename={path} />
        )}
        <span className="">
          {isFolder ? path.replace(/\/$/, '') : splitPath(path).pop()}
        </span>
      </span>
    </span>
  );
};

export default PathChip;
