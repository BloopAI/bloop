import React, { useCallback, useEffect, useState } from 'react';
import Code from '../../components/CodeBlock/Code';
import FileIcon from '../../components/FileIcon';
import BreadcrumbsPath from '../../components/BreadcrumbsPath';
import { FileTreeFileType } from '../../types';
import { getFileLines, getHoverables } from '../../services/api';
import { File, FileSearchResponse } from '../../types/api';
import { FullResult } from '../../types/results';
import { FullResultModeEnum } from '../../types/general';
import { mapFileResult, mapRanges } from '../../mappers/results';
import { useSearch } from '../../hooks/useSearch';
import ResultModal from '../ResultModal';

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
  const [fileParts, setFileParts] = useState<File[]>([]);
  const [mode, setMode] = useState<FullResultModeEnum>(
    FullResultModeEnum.MODAL,
  );
  const [openResult, setOpenResult] = useState<FullResult | null>(null);
  const { searchQuery: fileModalSearchQuery, data: fileResultData } =
    useSearch<FileSearchResponse>();

  useEffect(() => {
    Promise.all(
      citations.map((c) =>
        getFileLines(
          `open:true repo:${repoName} path:${filePath}`,
          c.start_line,
          c.end_line,
        ),
      ),
    ).then((resps) => {
      setFileParts(resps.map((resp) => resp.data[0].data as File));
    });
  }, [filePath, repoName, citations]);

  const onResultClick = useCallback(
    (path: string) => {
      fileModalSearchQuery(`open:true repo:${repoName} path:${path}`);
    },
    [repoName],
  );

  const handleModeChange = useCallback((m: FullResultModeEnum) => {
    setMode(m);
  }, []);

  const onResultClosed = useCallback(() => {
    setOpenResult(null);
  }, [mode]);

  useEffect(() => {
    if (fileResultData?.data?.length) {
      setOpenResult(mapFileResult(fileResultData.data[0]));
      getHoverables(
        fileResultData.data[0].data.relative_path,
        fileResultData.data[0].data.repo_ref,
      ).then((data) => {
        setOpenResult((prevState) => ({
          ...prevState!,
          hoverableRanges: mapRanges(data.ranges),
        }));
      });
    }
  }, [fileResultData]);

  return (
    <div className="flex gap-3 w-full overflow-hidden">
      <div className="text-sm border border-gray-700 rounded-md flex-1 overflow-auto">
        <div className="w-full bg-gray-800 py-1 px-3 border-b border-gray-700 select-none">
          <div className="flex items-center gap-2 max-w-[calc(100%-120px)] w-full h-11.5">
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
        {fileParts.length ? (
          <div className="relative overflow-auto py-4">
            {citations.map((c, i) => (
              <span key={c.i}>
                <Code
                  lineStart={c.start_line}
                  code={fileParts[i].contents
                    .split('\n')
                    .slice(Math.max(c.start_line - 1, 0), c.end_line)
                    .join('\n')}
                  language={fileParts[i].lang}
                  highlightColor={`rgba(${colors[c.i % colors.length].join(
                    ', ',
                  )}, 1)`}
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
      <ResultModal
        result={openResult}
        onResultClosed={onResultClosed}
        mode={mode}
        setMode={handleModeChange}
      />
    </div>
  );
};

export default CodeAnnotation;
