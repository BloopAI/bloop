import React from 'react';
import { CloseSign, PenUnderline } from '../../icons';
import Button from '../Button';

type Props = {
  visible: boolean;
  author: string;
  comment: string;
  readonly: boolean;
  avatar: string;
  onClose: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
};

const CommentItemExpanded = ({
  visible,
  comment,
  avatar,
  author,
  readonly,
  onClose,
  onRemove,
  onEdit,
}: Props) => {
  return (
    <span
      className={`bg-gray-900/75 flex flex-col gap-3 border-gray-800 border rounded-md mt-4 divide-y divide-gray-700 transition-all duration-300 ease-in-bounce ${
        readonly ? 'w-80' : 'w-96'
      } ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {readonly ? (
        <>
          <span className="flex gap-2 text-gray-500 justify-between p-3 pb-0 items-center">
            <span className="flex gap-2 items-center">
              <img className="w-6 h-6" src={avatar} alt="" />
              <span className="text-gray-100 text-sm">{author}</span>
            </span>
            <Button
              size={'small'}
              variant="tertiary"
              onlyIcon
              onClick={onClose}
              title="Close"
            >
              <CloseSign />
            </Button>
          </span>
          <span className="p-4">
            <span className="text-gray-400 text-sm">{comment}</span>
          </span>
        </>
      ) : (
        <>
          <span className="flex flex-row p-3 pb-1 justify-between items-center">
            <span className="flex items-center gap-3">
              <Button size={'medium'} variant={'secondary'} onClick={onRemove}>
                Remove comment
              </Button>
              <Button
                size={'small'}
                variant={'tertiary'}
                onlyIcon
                onClick={onEdit}
                title="Edit comment"
              >
                <PenUnderline />
              </Button>
            </span>
            <Button
              size={'small'}
              variant={'tertiary'}
              onlyIcon
              onClick={onClose}
              title="Close"
            >
              <CloseSign />
            </Button>
          </span>
          <span className="p-4 flex flex-col gap-2">
            <span className="flex gap-2">
              <img className="w-6 h-6" src={avatar} alt="" />
              <span className="text-gray-100">{author}</span>
            </span>
            <span className="text-gray-400 ">{comment}</span>
          </span>
        </>
      )}
    </span>
  );
};
export default CommentItemExpanded;
