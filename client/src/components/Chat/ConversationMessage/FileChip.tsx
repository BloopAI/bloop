import React from 'react';
import FileIcon from '../../FileIcon';
import { ArrowOut } from '../../../icons';

type Props = {
  onClick: () => void;
  fileName: string;
};

const FileChip = ({ onClick, fileName }: Props) => {
  return (
    <button
      className={`inline-flex items-center bg-chat-bg-shade rounded-4 overflow-hidden 
                text-label-base hover:text-label-title border border-transparent hover:border-chat-bg-border 
                cursor-pointer align-middle`}
      onClick={onClick}
    >
      <span className="flex gap-1 px-1 py-0.5 items-center border-r border-chat-bg-border code-s">
        <FileIcon filename={fileName} noMargin />
        {fileName}
      </span>
      <span className="p-1 inline-flex items-center justify-center">
        <ArrowOut sizeClassName="w-3.5 h-3.5" />
      </span>
    </button>
  );
};

export default FileChip;
