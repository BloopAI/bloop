import React, { useEffect, useState } from 'react';
import Code from '../../../components/CodeBlock/Code';
import { getFileLines } from '../../../services/api';
import { FileResponse } from '../../../types/api';
import LiteLoader from '../../../components/Loaders/LiteLoader';
import { colors } from './index';

type Props = {
  filePath: string;
  repoRef: string;
  startLine: number;
  endLine: number;
  i: number;
  isLast: boolean;
  onResultClick: (path: string, lineNum?: number[]) => void;
};

const CodePart = ({
  filePath,
  repoRef,
  startLine,
  endLine,
  i,
  isLast,
  onResultClick,
}: Props) => {
  const [filePart, setFilePart] = useState<FileResponse | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    if (
      repoRef &&
      filePath &&
      startLine !== null &&
      startLine > -1 &&
      endLine !== null &&
      endLine > -1
    ) {
      getFileLines(repoRef, filePath, startLine, endLine).then((resp) => {
        setFilePart(resp);
      });
    }
  }, [filePath, repoRef, startLine, endLine]);

  return (
    <div
      id={`code-${i}`}
      data-last={isLast.toString()}
      style={{ scrollMarginTop: 80 }}
    >
      {(isLoading || !filePart) && (
        <div className="flex flex-col items-center py-8">
          <LiteLoader sizeClassName="w-7 h-7" />
          <p className="body-s text-label-base">Loading code line ranges...</p>
        </div>
      )}
      <div
        className={`${isLoading ? 'opacity-0' : 'opacity-100'} cursor-pointer`}
        onClick={(e) => {
          if (filePart) {
            e.stopPropagation();
            onResultClick(filePath, [Math.max(startLine - 1, 0), endLine - 1]);
          }
        }}
      >
        {filePart && (
          <Code
            lineStart={startLine - 1}
            code={filePart.contents.slice(0, -1)} // there is always a trailing new line
            language={filePart.lang}
            highlightColor={`rgba(${colors[i % colors.length].join(', ')}, 1)`}
            onTokensLoaded={() => setLoading(false)}
          />
        )}
      </div>
      {!isLast ? (
        <pre className={`bg-bg-sub my-0 px-2`}>
          <table>
            <tbody>
              <tr className="token-line">
                <td className={`w-0 px-1 text-center`} />
                <td className="text-label-muted min-w-6 text-right	text-l select-none">
                  ..
                </td>
              </tr>
            </tbody>
          </table>
        </pre>
      ) : (
        ''
      )}
    </div>
  );
};

export default CodePart;
