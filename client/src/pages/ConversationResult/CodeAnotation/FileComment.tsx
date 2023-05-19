import React from 'react';
import { colors } from './index';

type Props = {
  i: number;
  comment: string;
};

const FileComment = ({ i, comment }: Props) => {
  return (
    <div
      className={`bg-bg-base border border-bg-border rounded-4 py-4 px-3 flex flex-col gap-2 text-label-title
        transition-all duration-75 ease-linear cursor-pointer`}
      id={`comment-${i}`}
      onClick={() => {
        document
          .getElementById(`code-${i}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
    >
      <div
        className="border-l-2 pl-3 break-words"
        style={{
          borderColor: `rgb(${colors[i % colors.length].join(', ')})`,
        }}
      >
        {comment}
      </div>
    </div>
  );
};

export default FileComment;
