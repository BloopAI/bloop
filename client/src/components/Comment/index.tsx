import React, { useState } from 'react';
import CommentItemExpanded from './CommentItemExpanded';

type Props = {
  author: string;
  comment: string;
  readonly?: boolean;
  avatar: string;
};

const Comment = ({ comment, readonly, author, avatar }: Props) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <span>
      <span
        className={`z-20 peer absolute top-32 w-8 h-8`}
        onClick={() => setExpanded(true)}
      />
      <span className="absolute top-[-0.4rem]">
        <CommentItemExpanded
          author={author}
          comment={comment}
          readonly={!!readonly}
          avatar={avatar}
          onClose={() => {
            setExpanded(false);
          }}
          visible={expanded}
        />
      </span>
      <span
        className={
          expanded
            ? 'hidden'
            : '' +
              `block w-8 h-8 bg-gray-800 rounded-14 rounded-bl p-[0.1875rem] absolute top-32 group border border-gray-700 ` +
              `peer-hover:h-40 peer-hover:top-2 peer-hover:w-96 peer-hover:opacity-100 peer-hover:rounded-full peer-hover:rounded duration-150 ` +
              `peer-hover:p-4 peer-hover:bg-gray-900/75 ease-in-bounce origin-bottom-left overflow-hidden cursor-pointer z-10`
        }
      >
        <span className="w-8 h-8 block peer-hover:pt-2 ">
          <img className="w-6 h-6" src={avatar} alt="" />
        </span>
        <span className="flex flex-col">
          <span className="text-gray-100 block">{author}</span>
          <span className="text-sm mt-2">
            <span className="text-gray-400 line-clamp-3">{comment}</span>
          </span>
        </span>
      </span>
    </span>
  );
};

export default Comment;
