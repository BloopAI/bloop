import React, { useCallback, MouseEvent } from 'react';
import FileIcon from '../FileIcon';
import { FileTreeFileType } from '../../types';
import CodeFragment from '../Code/CodeFragment';
import BreadcrumbsPathContainer from '../Breadcrumbs/PathContainer';
import CopyButton from './CopyButton';

type Props = {
  filePath: string;
  onResultClick: (path: string, lines?: string) => void;
  startLine: number | null;
  language: string;
  code: string;
  repoRef?: string;
  isCodeStudio?: boolean;
};

const CodeWithBreadcrumbs = ({
  filePath,
  onResultClick,
  startLine,
  language,
  code,
  repoRef,
  isCodeStudio,
}: Props) => {
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
  const onBreadcrumbClick = useCallback(
    (path: string, type?: FileTreeFileType) => {
      type === FileTreeFileType.FILE ? onResultClick(path) : {};
    },
    [onResultClick],
  );

  return (
    <div
      className={`${
        isCodeStudio ? ' code-mini my-4' : ' text-sm'
      } border border-bg-border bg-bg-sub rounded-md flex-1 overflow-x-auto cursor-pointer`}
      onClick={handleResultClick}
    >
      <div
        className={`flex items-center justify-between gap-2 w-full border-b border-bg-border bg-bg-base p-2 cursor-pointer overflow-hidden`}
      >
        <div className={`flex items-center gap-2 w-full cursor-pointer`}>
          <FileIcon filename={filePath} />
          <BreadcrumbsPathContainer
            path={filePath}
            repoRef={repoRef}
            onClick={onBreadcrumbClick}
          />
          <CopyButton code={code} isInHeader btnVariant="tertiary" />
        </div>
      </div>
      <div className="relative">
        <div className={`relative overflow-x-auto py-4 code-mini`}>
          <CodeFragment
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
