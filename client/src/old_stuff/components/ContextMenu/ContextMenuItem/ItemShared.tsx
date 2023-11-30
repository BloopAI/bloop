import React, { MouseEvent } from 'react';
import TextField from '../../../../components/TextField';
import { DragVertical, TrashCan } from '../../../../icons';
import Button from '../../../../components/Button';

export type ItemProps = {
  text: string | React.ReactElement;
  icon?: React.ReactElement;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  onDelete?: () => void;
  removable?: boolean;
  annotations: number;
};

const ItemShared = ({
  onClick,
  text,
  icon,
  annotations,
  removable,
  onDelete,
}: ItemProps) => {
  return (
    <span
      className={`p-2.5 group hover:bg-bg-base-hover active:bg-transparent text-label-base flex items-center justify-between 
        rounded cursor-pointer transition-all duration-150 ease-in-bounce`}
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        <span className="text-label-muted">
          <DragVertical />
        </span>
        <span className="flex flex-col">
          <TextField value={text} icon={icon} />
          <span className="text-label-muted text-xs">
            {annotations} annotations
          </span>
        </span>
      </span>
      <span>
        {removable ? (
          <Button
            size={'small'}
            variant={'tertiary'}
            onlyIcon
            className="invisible group-hover:visible duration-100"
            onClick={onDelete}
            title="Delete"
          >
            <TrashCan />
          </Button>
        ) : (
          ''
        )}
      </span>
    </span>
  );
};

export default ItemShared;
