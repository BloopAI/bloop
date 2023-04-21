import React from 'react';
import Code from '../../components/CodeBlock/Code';
import Button from '../../components/Button';
import { Clipboard } from '../../icons';
import { copyToClipboard, splitPathForBreadcrumbs } from '../../utils';
import FileIcon from '../../components/FileIcon';
import BreadcrumbsPath from '../../components/BreadcrumbsPath';
import { FileTreeFileType } from '../../types';
import { MessageResultModify } from '../../types/general';
import Breadcrumbs from '../../components/Breadcrumbs';

type Props = {
  data: MessageResultModify['Modify'];
};

const DiffCode = ({ data }: Props) => {
  return (
    <div className="text-sm border border-gray-700 rounded-md">
      <div className="w-full bg-gray-800 py-1 px-3 border-b border-gray-700 select-none">
        <div className="flex items-center gap-2 max-w-[calc(100%-120px)] w-full h-11.5">
          <FileIcon filename={data.path} />
          <div className="overflow-hidden">
            <Breadcrumbs
              pathParts={splitPathForBreadcrumbs(data.path, () => {})}
              path={data.path}
            />
          </div>
        </div>
      </div>
      {data.diff?.lines ? (
        <div className="relative py-4">
          <div className="overflow-auto">
            <Code
              lineStart={data.diff.header?.old_start}
              code={data.diff.lines?.join('\n')}
              language={data.language}
            />
          </div>
          <div className="absolute top-4 right-4">
            <Button
              variant="secondary"
              size="small"
              onClick={() => copyToClipboard(data.diff.lines.join('\n'))}
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
