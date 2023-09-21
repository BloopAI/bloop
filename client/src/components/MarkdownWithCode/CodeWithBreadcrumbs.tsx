import React, { useCallback, MouseEvent, useState } from 'react';
import FileIcon from '../FileIcon';
import BreadcrumbsPath from '../BreadcrumbsPath';
import { FileTreeFileType } from '../../types';
import Code from '../CodeBlock/Code';
import Button from '../Button';
import { copyToClipboard } from '../../utils';
import { CheckIcon, Clipboard } from '../../icons';
import CopyButton from './CopyButton';

type Props = {
  filePath: string;
  repoName?: string;
  onResultClick: (path: string, lines?: string) => void;
  startLine: number | null;
  language: string;
  code: string;
  isSummary?: boolean;
};

const CodeWithBreadcrumbs = ({
  filePath,
  repoName,
  onResultClick,
  startLine,
  language,
  code,
  isSummary,
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
      className={`text-sm border border-chat-bg-divider rounded-md flex-1 overflow-x-auto cursor-pointer ${
        isSummary ? '' : 'my-4'
      }`}
      onClick={handleResultClick}
    >
      <div
        className={`flex items-center justify-between gap-2 w-full border-b ${
          isSummary
            ? 'bg-chat-bg-sub'
            : 'bg-chat-bg-shade border-chat-bg-divider'
        } p-2 cursor-pointer overflow-hidden`}
      >
        <div
          className={`flex items-center gap-2 w-full cursor-pointer ${
            isSummary ? '-mt-5' : ''
          }`}
        >
          <FileIcon filename={filePath} />
          <BreadcrumbsPath
            path={filePath}
            repo={repoName || ''}
            onClick={(path, type) =>
              type === FileTreeFileType.FILE ? onResultClick(path) : {}
            }
          />
          <CopyButton code={code} isInHeader />
        </div>
      </div>
      <div className="relative">
        <div className={`relative overflow-x-auto py-4 bg-chat-bg-base`}>
          <Code
            code={code}
            language={language}
            showLines={startLine !== null}
            lineStart={startLine || 0}
          />
        </div>
      </div>
    </div>
  );
};

export default CodeWithBreadcrumbs;
