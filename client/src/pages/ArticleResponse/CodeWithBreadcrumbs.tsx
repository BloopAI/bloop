import React, { useCallback, MouseEvent } from 'react';
import FileIcon from '../../components/FileIcon';
import BreadcrumbsPath from '../../components/BreadcrumbsPath';
import { FileTreeFileType } from '../../types';
import Code from '../../components/CodeBlock/Code';

type Props = {
  filePath: string;
  repoName: string;
  onResultClick: (path: string, lines?: [number, number]) => void;
  startLine: number;
  endLine: number;
  language: string;
  code: string;
};

const CodeWithBreadcrumbs = ({
  filePath,
  repoName,
  onResultClick,
  startLine,
  endLine,
  language,
  code,
}: Props) => {
  const handleResultClick = useCallback((e: MouseEvent) => {
    if (!document.getSelection()?.toString()) {
      e.stopPropagation();
      onResultClick(filePath, [Math.max(startLine - 1, 0), endLine - 1]);
    }
  }, []);

  return (
    <div
      className="text-sm border border-bg-border rounded-md flex-1 overflow-x-auto cursor-pointer my-4"
      onClick={handleResultClick}
    >
      <div
        className={`flex items-center justify-between gap-2 w-full bg-bg-shade h-13 px-3 cursor-pointer overflow-hidden`}
      >
        <div className="flex items-center gap-2 w-full cursor-pointer">
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
      <div className={`relative overflow-x-auto py-4`}>
        <Code code={code} language={language} lineStart={startLine} />
      </div>
    </div>
  );
};

export default CodeWithBreadcrumbs;
