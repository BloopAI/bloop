import React from 'react';
import Code from '../../components/CodeBlock/Code';
import Button from '../../components/Button';
import { Clipboard } from '../../icons';
import { copyToClipboard } from '../../utils';
import FileIcon from '../../components/FileIcon';
import BreadcrumbsPath from '../../components/BreadcrumbsPath';
import { FileTreeFileType } from '../../types';
import { MessageResultModify } from '../../types/general';

type Props = {
  data: MessageResultModify['Modify'];
};

const DiffCode = ({ data }: Props) => {
  return (
    <div className="text-sm border border-gray-700 rounded-md">
      <div className="w-full bg-gray-800 py-1 px-3 border-b border-gray-700 select-none">
        <div className="flex items-center gap-2 max-w-[calc(100%-120px)] w-full h-11.5">
          {data.diff.old_file_name !== data.diff.new_file_name && '-'}
          <FileIcon filename={data.diff.old_file_name} />
          <BreadcrumbsPath
            path={data.diff.old_file_name}
            repo={''}
            onClick={(path, type) => (type === FileTreeFileType.FILE ? {} : {})}
          />
        </div>
        {data.diff.old_file_name !== data.diff.new_file_name && (
          <div className="flex items-center gap-2 max-w-[calc(100%-120px)] w-full h-11.5">
            + <FileIcon filename={data.diff.new_file_name} />
            <BreadcrumbsPath
              path={data.diff.new_file_name}
              repo={''}
              onClick={(path, type) =>
                type === FileTreeFileType.FILE ? {} : {}
              }
            />
          </div>
        )}
      </div>
      {data.diff.hunks?.[0]?.lines ? (
        <div className="relative overflow-auto py-4">
          <Code
            lineStart={data.diff.hunks?.[0]?.old_start}
            code={data.diff.hunks?.[0]?.lines?.join('\n')}
            language={'TSX'}
          />
          <div className="absolute top-4 right-4">
            <Button
              variant="secondary"
              size="small"
              onClick={() =>
                copyToClipboard(data.diff.hunks[0].lines.join('\n'))
              }
            >
              <Clipboard />
              Copy
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DiffCode;
