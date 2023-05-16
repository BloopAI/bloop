import React, { useMemo } from 'react';
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
  return (
    <div className="flex gap-3 w-full overflow-x-hidden">
      <div className="flex flex-col gap-3 flex-1 overflow-hidden">
        {Object.keys(citations).map((filePath) => (
          <Directory
            key={filePath}
            repo={repoName}
            path={filePath}
            i={citations[filePath][0].i}
          />
        ))}
      </div>
      <div className="relative flex flex-col gap-3 w-96 flex-grow-0 overflow-y-auto">
        {Object.values(citations)
          .flat()
          .map((cite) => (
            <FileComment i={cite.i} comment={cite.comment} key={cite.i} />
          ))}
      </div>
    </div>
  );
};

export default DirectoryAnnotation;
