import React from 'react';
import Code from '../../components/CodeBlock/Code';
import Button from '../../components/Button';
import { Clipboard } from '../../icons';
import { copyToClipboard } from '../../utils';
import FileIcon from '../../components/FileIcon';
import BreadcrumbsPath from '../../components/BreadcrumbsPath';
import { FileTreeFileType } from '../../types';

type Props = {
  data: any;
};

const DiffCode = ({ data }: Props) => {
  return (
    <div className="text-sm border border-gray-700 rounded-md">
      <div className="w-full bg-gray-800 py-1 px-3 border-b border-gray-700 select-none">
        <div className="flex items-center gap-2 max-w-[calc(100%-120px)] w-full h-11.5">
          {data.oldFileName !== data.newFileName && '-'}
          <FileIcon filename={data.oldFileName} />
          <BreadcrumbsPath
            path={data.oldFileName}
            repo={''}
            onClick={(path, type) => (type === FileTreeFileType.FILE ? {} : {})}
          />
        </div>
        {data.oldFileName !== data.newFileName && (
          <div className="flex items-center gap-2 max-w-[calc(100%-120px)] w-full h-11.5">
            + <FileIcon filename={data.newFileName} />
            <BreadcrumbsPath
              path={data.newFileName}
              repo={''}
              onClick={(path, type) =>
                type === FileTreeFileType.FILE ? {} : {}
              }
            />
          </div>
        )}
      </div>
      {data.hunks?.[0]?.lines ? (
        <div className="relative overflow-auto py-4">
          <Code
            lineStart={data.hunks?.[0]?.oldStart}
            code={data.hunks?.[0]?.lines?.join('\n')}
            language={'TSX'}
          />
          <div className="absolute top-4 right-4">
            <Button
              variant="secondary"
              size="small"
              onClick={() => copyToClipboard(data.hunks[0].lines.join('\n'))}
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
