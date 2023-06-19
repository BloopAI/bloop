import React, { useState } from 'react';
import FileComment from '../CodeAnotation/FileComment';
import Directory from './Directory';

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

const DirectoryAnnotation = ({ repoName, citations }: Props) => {
  const [collapsedDirs, setCollapsedDirs] = useState<number[]>([]);
  const [fullExpandedDirs, setFullExpandedDirs] = useState<number[]>([]);
  return (
    <div className="flex gap-3 w-full overflow-x-hidden">
      <div className="flex flex-col gap-3 flex-1 overflow-hidden">
        {Object.keys(citations).map((filePath, index) => (
          <Directory
            key={filePath}
            repo={repoName}
            path={filePath}
            i={citations[filePath][0].i}
            isReady={!!citations[filePath][0].comment}
            onCollapse={() => setCollapsedDirs((prev) => [...prev, index])}
            onExpand={() =>
              setCollapsedDirs((prev) => prev.filter((fi) => fi !== index))
            }
            isCollapsed={collapsedDirs.includes(index)}
            onFullExpand={() => setFullExpandedDirs((prev) => [...prev, index])}
            onFullCollapse={() =>
              setFullExpandedDirs((prev) => prev.filter((fi) => fi !== index))
            }
            isFullExpanded={fullExpandedDirs.includes(index)}
          />
        ))}
      </div>
      <div className="relative flex flex-col gap-3 w-96 flex-grow-0 overflow-y-auto">
        {Object.keys(citations)
          .map((filePath, index) => {
            return collapsedDirs.includes(index) ||
              !fullExpandedDirs.includes(index) ? (
              <div
                id={`comment-${citations[filePath][0].i}`}
                className="flex flex-col gap-3 transition-all duration-75 ease-linear z-0"
              >
                {citations[filePath].map((cite, i) => (
                  <FileComment
                    i={cite.i}
                    comment={cite.comment}
                    key={`${index}-${i}`}
                    isCollapsed={collapsedDirs.includes(index)}
                    isBoxed
                  />
                ))}
              </div>
            ) : (
              citations[filePath].map((cite, i) => (
                <FileComment
                  i={cite.i}
                  comment={cite.comment}
                  key={`${index}-${i}`}
                />
              ))
            );
          })
          .flat()}
      </div>
    </div>
  );
};

export default DirectoryAnnotation;
