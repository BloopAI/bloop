import React, { useEffect, useState } from 'react';
import Code from '../../components/CodeBlock/Code';
import Button from '../../components/Button';
import { Conversation } from '../../icons';
import FileIcon from '../../components/FileIcon';
import BreadcrumbsPath from '../../components/BreadcrumbsPath';
import { FileTreeFileType } from '../../types';
import { search as searchApiCall } from '../../services/api';
import { File } from '../../types/api';

type Props = {
  filePath: string;
  repoName: string;
  citations: {
    start_line: number;
    end_line: number;
    comment: string;
    i: number;
  }[];
};

const colors = [
  [253, 201, 0],
  [14, 164, 233],
  [236, 72, 153],
  [132, 204, 23],
  [139, 92, 246],
  [20, 184, 166],
];

const CodeAnnotation = ({ filePath, repoName, citations }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    searchApiCall(`open:true repo:${repoName} path:${filePath}`).then(
      (resp) => {
        setFile(resp.data[0].data as File);
      },
    );
  }, [filePath, repoName]);

  return (
    <div className="flex gap-3 w-full overflow-hidden">
      <div className="text-sm border border-gray-700 rounded-md flex-1 overflow-auto">
        <div className="w-full bg-gray-800 py-1 px-3 border-b border-gray-700 select-none">
          <div className="flex items-center gap-2 max-w-[calc(100%-120px)] w-full h-11.5">
            <FileIcon filename={filePath} />
            <BreadcrumbsPath
              path={filePath}
              repo={''}
              onClick={(path, type) =>
                type === FileTreeFileType.FILE ? {} : {}
              }
            />
          </div>
        </div>
        {file ? (
          <div className="relative overflow-auto py-4">
            {citations.map((c, i) => (
              <span key={c.i}>
                <Code
                  lineStart={c.start_line}
                  code={file.contents
                    .split('\n')
                    .slice(Math.max(c.start_line - 1, 0), c.end_line)
                    .join('\n')}
                  language={file.lang}
                  highlightColor={`rgba(${colors[c.i % colors.length].join(
                    ', ',
                  )}, 0.20)`}
                />
                {i !== citations.length - 1 ? (
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
            ))}
          </div>
        ) : null}
      </div>
      <div className="relative flex flex-col gap-3 w-96">
        {citations.map((cite, i) => (
          <div
            className="bg-gray-800 border border-gray-700 shadow-light-bigger rounded-4  py-4 px-3 flex flex-col gap-2 mb-1"
            key={i}
          >
            <div
              className="border-l-2 pl-3"
              style={{
                borderColor: `rgb(${colors[cite.i % colors.length].join(
                  ', ',
                )})`,
              }}
            >
              {cite.comment}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CodeAnnotation;
