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
      className={`bg-bg-base flex flex-col gap-3 border-bg-border border rounded-md mt-4 divide-y divide-bg-border transition-all duration-300 ease-in-bounce ${
        readonly ? 'w-80' : 'w-96'
      } ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {readonly ? (
        <>
          <span className="flex gap-2 text-label-muted justify-between p-3 pb-0 items-center">
            <span className="flex gap-2 items-center">
              <img className="w-6 h-6" src={avatar} alt="" />
              <span className="text-label-title text-sm">{author}</span>
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
            <span className="text-label-base text-sm">{comment}</span>
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
              <span className="text-label-title">{author}</span>
            </span>
            <span className="text-label-base">{comment}</span>
          </span>
        </>
      )}
    </span>
  );
};
export default CommentItemExpanded;
