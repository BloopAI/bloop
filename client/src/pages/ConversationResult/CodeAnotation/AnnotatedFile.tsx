import React, { useEffect, useMemo, useState } from 'react';
import FileIcon from '../../../components/FileIcon';
import BreadcrumbsPath from '../../../components/BreadcrumbsPath';
import { FileTreeFileType } from '../../../types';
import { search } from '../../../services/api';
import { File } from '../../../types/api';
import { getPrismLanguage, tokenizeCode } from '../../../utils/prism';
import { TokensLine } from '../../../types/results';
import Button from '../../../components/Button';
import { ChevronDownFilled, ChevronUpFilled } from '../../../icons';
import { buildRepoQuery } from '../../../utils';
import CodePart from './CodePart';

type Props = {
  repoName: string;
  filePath: string;
  index: number;
  onResultClick: (path: string, lineNum?: number[]) => void;
  cites: {
    start_line: number;
    end_line: number;
    comment: string;
    i: number;
  }[];
  isCollapsed?: boolean;
  onExpand: () => void;
  onCollapse: () => void;
};

const AnnotatedFile = ({
  filePath,
  onResultClick,
  repoName,
  cites,
  index,
  isCollapsed,
  onExpand,
  onCollapse,
}: Props) => {
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    if (repoName && filePath) {
      search(buildRepoQuery(repoName, filePath)).then((resp) => {
        setFile(resp.data[0].data as File);
      });
    }
  }, [filePath, repoName]);

  const lang = useMemo(
    () =>
      file?.lang
        ? getPrismLanguage(file?.lang || '') || 'plaintext'
        : undefined,
    [file?.lang],
  );

  const tokens = useMemo(
    () => (file?.contents && lang ? tokenizeCode(file?.contents, lang) : []),
    [file?.contents, lang],
  );

  const tokensMap = useMemo((): TokensLine[] => {
    const lines = tokens
      .map((line) => line.map((token) => ({ highlight: false, token })))
      .map((l): TokensLine => ({ tokens: l, lineNumber: null }));
    let currentLine = 0;
    for (let i = 0; i < lines.length; i++) {
      lines[i].lineNumber = currentLine + 1;
      currentLine++;
    }
    return lines;
  }, [tokens]);

  return (
    <div>
      <div
        className="text-sm border border-bg-border rounded-md flex-1 overflow-auto"
        id={`file-${index}`}
      >
        <div
          className={`flex items-center justify-between gap-2 w-full bg-bg-shade h-13 px-3 ${
            !isCollapsed ? 'border-b border-bg-border' : ''
          } select-none cursor-pointer`}
          onClick={() => onResultClick(filePath)}
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
          <Button
            onlyIcon
            size="tiny"
            variant="tertiary"
            onClick={(e) => {
              e.stopPropagation();
              if (isCollapsed) {
                onExpand();
              } else {
                onCollapse();
              }
            }}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronDownFilled /> : <ChevronUpFilled />}
          </Button>
        </div>
        {!isCollapsed && cites.length ? (
          <div className="relative overflow-auto py-4">
            {cites.map((c, i) => (
              <CodePart
                key={c.i}
                i={c.i}
                filePath={filePath}
                startLine={c.start_line}
                endLine={c.end_line}
                lang={lang}
                isLast={i === cites.length - 1}
                onResultClick={onResultClick}
                tokensMap={tokensMap}
                prevPartEnd={cites[i - 1]?.end_line}
                nextPartStart={cites[i + 1]?.start_line}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AnnotatedFile;
