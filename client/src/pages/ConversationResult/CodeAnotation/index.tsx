import React, { useCallback, useMemo, useState } from 'react';
import FileModalContainer from '../../ResultModal/FileModalContainer';
import AnnotatedFile from './AnnotatedFile';
import FileComment from './FileComment';

export type Comment = {
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
  const [isModalOpen, setModalOpen] = useState(false);
  const [openPath, setOpenPath] = useState('');
  const [scrollToLine, setScrollToLine] = useState<string | undefined>(
    undefined,
  );

  const onResultClick = useCallback(
    (path: string, lineNumber?: number[]) => {
      setScrollToLine(lineNumber ? lineNumber.join('_') : undefined);
      setOpenPath(path);
      setModalOpen(true);
    },
    [repoName],
  );

  const comments = useMemo(() => {
    return Object.values(citations)
      .map((fc) => fc.map((c) => c))
      .flat();
  }, [citations]);

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
      <FileModalContainer
        repoName={repoName}
        path={openPath}
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        scrollToLine={scrollToLine}
      />
    </div>
  );
};

export default CodeAnnotation;
