import React, { useCallback, MouseEvent, useState } from 'react';
import FileIcon from '../../components/FileIcon';
import BreadcrumbsPath from '../../components/BreadcrumbsPath';
import { FileTreeFileType } from '../../types';
import Code from '../../components/CodeBlock/Code';
import Button from '../../components/Button';
import { copyToClipboard } from '../../utils';
import { CheckIcon, Clipboard } from '../../icons';

type Props = {
  filePath: string;
  repoName: string;
  onResultClick: (path: string, lines?: string) => void;
  startLine: number;
  language: string;
  code: string;
};

const CodeWithBreadcrumbs = ({
  filePath,
  repoName,
  onResultClick,
  startLine,
  language,
  code,
}: Props) => {
  const [codeCopied, setCodeCopied] = useState(false);

  const handleResultClick = useCallback(
    (e: MouseEvent) => {
      if (!document.getSelection()?.toString()) {
        e.stopPropagation();
        onResultClick(
          filePath,
          startLine
            ? `${Math.max(startLine, 0)}_${
                startLine + code.split('\n').length - 1
              }`
            : undefined,
        );
      }
    },
    [filePath, startLine, code, onResultClick],
  );

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
      <div className="relative">
        <div className={`relative overflow-x-auto py-4`}>
          <Code code={code} language={language} lineStart={startLine} />
        </div>
        <div
          className={`absolute ${
            code.split('\n').length > 1 ? 'top-4 right-4' : 'top-2.5 right-2.5'
          }`}
        >
          <Button
            variant="tertiary"
            size="small"
            onClick={() => {
              copyToClipboard(code);
              setCodeCopied(true);
              setTimeout(() => setCodeCopied(false), 2000);
            }}
          >
            {codeCopied ? <CheckIcon /> : <Clipboard />}
            {codeCopied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CodeWithBreadcrumbs;
