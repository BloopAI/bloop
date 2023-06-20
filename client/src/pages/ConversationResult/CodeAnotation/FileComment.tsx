import React from 'react';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import { colors } from './index';

type Props = {
  i: number;
  comment: string;
  isCollapsed?: boolean;
  isBoxed?: boolean;
  onClick?: () => void;
};

const FileComment = ({ i, comment, isCollapsed, isBoxed, onClick }: Props) => {
  return (
    <div
      className={`bg-bg-base border border-bg-border rounded-4 ${
        isCollapsed ? 'py-0.5' : 'py-3.5'
      } px-3 flex flex-col gap-2 text-label-title
        transition-all duration-75 ease-linear cursor-pointer z-10`}
      id={isBoxed ? undefined : `comment-${i}`}
      onClick={() => {
        onClick?.();
        setTimeout(
          () =>
            findElementInCurrentTab(`#code-${i}`)?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            }),
          400,
        );
      }}
    >
      {!isCollapsed && (
        <div
          className="border-l-2 pl-3 break-words"
          style={{
            borderColor: `rgb(${colors[i % colors.length].join(', ')})`,
          }}
        >
          {comment}
        </div>
      )}
    </div>
  );
};

export default FileComment;
