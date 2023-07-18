import React from 'react';
import { Trans } from 'react-i18next';
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
      className={`transition-all duration-300 ease-in-bounce 
      px-4 block py-3 cursor-pointer w-full group text-start hover:bg-chat-bg-base-hover`}
      onClick={onClick}
    >
      <span
        className={`flex w-full items-start justify-start gap-2 text-label-base group-hover:text-label-title transition-all duration-300 ease-in-bounce `}
      >
        <QuillIcon />
        <div className="flex-1 overflow-hidden">
          <div className="ellipsis body-s w-full text-label-base group-hover:text-label-title transition-all duration-300 ease-in-bounce ">
            {title}
          </div>
          <div className="caption text-label-muted group-hover:text-label-base transition-all duration-300 ease-in-bounce ">
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
            <Trans>Delete</Trans>
          </Button>
        </div>
      </span>
    </div>
  );
};

export default ConversationListItem;
