import React from 'react';
import FileIcon from '../../../components/FileIcon';
import BreadcrumbsPath from '../../../components/BreadcrumbsPath';
import { FileTreeFileType } from '../../../types';
import CodePart from './CodePart';

type Props = {
  repoName: string;
  repoRef: string;
  filePath: string;
  onResultClick: (path: string) => void;
  cites: {
    start_line: number;
    end_line: number;
    comment: string;
    i: number;
  }[];
};

const AnnotatedFile = ({
  filePath,
  onResultClick,
  repoName,
  repoRef,
  cites,
}: Props) => {
  return (
    <div>
      <div className="text-sm border border-bg-border rounded-md flex-1 overflow-auto">
        <div
          className="w-full bg-bg-shade py-1 px-3 border-b border-bg-border select-none cursor-pointer"
          onClick={() => onResultClick(filePath)}
        >
          <div className="flex items-center gap-2 w-full h-11.5">
            <FileIcon filename={filePath} />
            <BreadcrumbsPath
              path={filePath}
              repo={repoName}
              onClick={(path, type) =>
                type === FileTreeFileType.FILE ? onResultClick(path) : {}
              }
            />
          </div>
        </div>
        {cites.length ? (
          <div className="relative overflow-auto py-4">
            {cites.map((c, i) => (
              <CodePart
                key={c.i}
                i={c.i}
                repoRef={repoRef}
                filePath={filePath}
                startLine={c.start_line}
                endLine={c.end_line}
                isLast={i === cites.length - 1}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AnnotatedFile;
