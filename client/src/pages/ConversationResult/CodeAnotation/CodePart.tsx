import React, { useEffect, useState } from 'react';
import Code from '../../../components/CodeBlock/Code';
import { getFileLines } from '../../../services/api';
import { File } from '../../../types/api';
import { colors } from './index';

type Props = {
  filePath: string;
  repoName: string;
  startLine: number;
  endLine: number;
  i: number;
  isLast: boolean;
};

const CodePart = ({
  filePath,
  repoName,
  startLine,
  endLine,
  i,
  isLast,
}: Props) => {
  const [filePart, setFilePart] = useState<File | null>(null);

  useEffect(() => {
    if (repoName && filePath && startLine > -1 && endLine > -1) {
      getFileLines(
        `open:true repo:${repoName} path:${filePath}`,
        startLine,
        endLine,
      ).then((resp) => {
        setFilePart(resp.data[0].data as File);
      });
    }
  }, [filePath, repoName, startLine, endLine]);

  return (
    <span>
      {filePart && (
        <Code
          lineStart={startLine}
          code={filePart?.contents
            .split('\n')
            .slice(Math.max(startLine - 1, 0), endLine)
            .join('\n')}
          language={filePart?.lang}
          highlightColor={`rgba(${colors[i % colors.length].join(', ')}, 1)`}
        />
      )}
      {!isLast ? (
        <pre className={` bg-gray-900 my-0 px-2`}>
          <table>
            <tbody>
              <tr className="token-line">
                <td className={`w-0 px-1 text-center`} />
                <td className="text-gray-500 min-w-6 text-right	text-l select-none">
                  ..
                </td>
              </tr>
            </tbody>
          </table>
        </pre>
      ) : (
        ''
      )}
    </span>
  );
};

export default CodePart;
