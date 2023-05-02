import React from 'react';
import { colors } from './index';

type Props = {
  i: number;
  comment: string;
};

const FileComment = ({ i, comment }: Props) => {
  return (
    <div
      className={`bg-gray-800 border border-gray-700 shadow-light-bigger rounded-4 py-4 px-3 flex flex-col gap-2 
        transition-all duration-300 ease-linear cursor-pointer`}
      id={`comment-${i}`}
      onClick={() => {
        document
          .getElementById(`code-${i}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
    >
      <div
        className="border-l-2 pl-3"
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
