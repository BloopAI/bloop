import React from 'react';
import { FileTreeFileType } from '../../types';
import { FolderFilled } from '../../icons';
import FileIcon from '../FileIcon';

type Props = {
  path: string;
  name: string;
  type: FileTreeFileType;
  onClick: (p: string, type: FileTreeFileType) => void;
};

const FileRow = ({ path, name, type, onClick }: Props) => {
  return (
    <button
      className="flex flex-row justify-between px-4 py-4 last:rounded-b group cursor-pointer text-left text-label-base body-s focus:outline-0"
      onClick={() => {
        onClick(path, type);
      }}
    >
      <span className="w-fit group-hover:text-label-title group-focus:text-label-title flex items-center gap-2">
        {type === FileTreeFileType.DIR ? (
          <FolderFilled />
        ) : (
          <FileIcon filename={name} />
        )}
        <span className="group-hover:underline group-focus:underline">
          {name}
        </span>
      </span>
    </button>
  );
};

export default FileRow;
