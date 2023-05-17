import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHoverables } from '../../../services/api';
import { FileSearchResponse } from '../../../types/api';
import { FullResult } from '../../../types/results';
import { FullResultModeEnum } from '../../../types/general';
import { mapFileResult, mapRanges } from '../../../mappers/results';
import { useSearch } from '../../../hooks/useSearch';
import ResultModal from '../../ResultModal';
import AnnotatedFile from './AnnotatedFile';
import FileComment from './FileComment';

type Comment = {
  start_line: number;
  end_line: number;
  comment: string;
  i: number;
  top?: number;
};

type Props = {
  repoName: string;
  citations: Record<string, Comment[]>;
};

export const colors = [
  [253, 201, 0],
  [14, 164, 233],
  [236, 72, 153],
  [132, 204, 23],
  [139, 92, 246],
  [20, 184, 166],
];

const CodeAnnotation = ({ repoName, citations }: Props) => {
  const [mode, setMode] = useState<FullResultModeEnum>(
    FullResultModeEnum.MODAL,
  );
  const [openResult, setOpenResult] = useState<FullResult | null>(null);
  const [scrollToLine, setScrollToLine] = useState<string | undefined>(
    undefined,
  );
  const { searchQuery: fileModalSearchQuery, data: fileResultData } =
    useSearch<FileSearchResponse>();
  const navigateBrowser = useNavigate();

  const onResultClick = useCallback(
    (path: string, lineNumber?: number[]) => {
      setScrollToLine(lineNumber ? lineNumber.join('_') : undefined);
      fileModalSearchQuery(`open:true repo:${repoName} path:${path}`);
    },
    [repoName],
  );

  const comments = useMemo(() => {
    return Object.values(citations)
      .map((fc) => fc.map((c) => c))
      .flat();
  }, [citations]);

  const handleModeChange = useCallback((m: FullResultModeEnum) => {
    setMode(m);
  }, []);

  const onResultClosed = useCallback(() => {
    setOpenResult(null);
  }, [mode]);

  useEffect(() => {
    if (fileResultData?.data?.length) {
      setOpenResult(mapFileResult(fileResultData.data[0]));
      navigateBrowser({
        search: scrollToLine
          ? '?' +
            new URLSearchParams({
              scroll_line_index: scrollToLine.toString(),
            }).toString()
          : '',
      });
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
    <div className="flex gap-3 w-full overflow-x-hidden">
      <div className="flex flex-col gap-3 flex-1 overflow-hidden">
        {Object.keys(citations).map((filePath) => (
          <AnnotatedFile
            key={filePath}
            repoName={repoName}
            filePath={filePath}
            onResultClick={onResultClick}
            cites={citations[filePath]}
          />
        ))}
      </div>
      <div className="relative flex flex-col gap-3 max-w-96 w-3/5 flex-grow-0 overflow-y-auto">
        {comments.map((cite, i) => (
          <FileComment i={cite.i} comment={cite.comment} key={i} />
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
