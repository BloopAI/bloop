import React from 'react';
import { QuillIcon } from '../../../icons';
import Button from '../../Button';

type Props = {
  onClick: () => void;
  title: string;
  subtitle: string;
  onDelete: () => void;
};

const ConversationListItem = ({
  onClick,
  title,
  subtitle,
  onDelete,
}: Props) => {
  return (
    <div
      className={`text-gray-300 active:text-gray-300 transition-all duration-300 ease-in-bounce 
      px-4 block py-3 cursor-pointer hover:text-gray-300 w-full group text-start hover:bg-gray-800`}
      onClick={onClick}
    >
      <span
        className={`flex w-full items-start justify-start gap-2 text-gray-500 group-hover:text-gray-300 transition-all duration-300 ease-in-bounce `}
      >
        <QuillIcon />
        <div className="flex-1 overflow-hidden">
          <div className="ellipsis body-s w-full text-gray-300 group-hover:text-gray-100 transition-all duration-300 ease-in-bounce ">
            {title}
          </div>
          <div className="caption group-hover:text-gray-400 transition-all duration-300 ease-in-bounce ">
            {subtitle}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-bounce">
          <Button
            variant="secondary"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            Delete
          </Button>
        </div>
      </span>
    </div>
  );
};

export default ConversationListItem;
