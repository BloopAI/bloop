import React, { MouseEvent, useState } from 'react';
import TextField from '../../TextField';
import { CheckIcon, TrashCan } from '../../../icons';
import Button from '../../Button';
import { MenuItemType } from '../../../types/general';
import Tooltip from '../../Tooltip';

export type ItemProps = {
  text: string | React.ReactElement;
  href?: string;
  icon?: React.ReactElement;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  onDelete?: () => void;
  type: MenuItemType;
  disabled?: boolean;
  tooltip?: string;
};

const Item = ({
  onClick,
  text,
  icon,
  type,
  onDelete,
  href,
  disabled,
  tooltip,
}: ItemProps) => {
  const [selected, setSelected] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (type === MenuItemType.DANGER && !showConfirmation) {
      setShowConfirmation(true);
    } else if (type === MenuItemType.SELECTABLE) {
      setSelected(!selected);
    } else {
      if (onClick) {
        onClick(e);
        setShowConfirmation(false);
      }
    }
  };

  const Comp =
    type === MenuItemType.LINK
      ? (props: any) => <a {...props} href={href} />
      : (props: any) => <span {...props} />;

  const item = (
    <Comp
      className={`p-2.5 group ${
        disabled
          ? 'text-gray-500 cursor-default'
          : type === MenuItemType.DANGER
          ? 'hover:bg-gray-700 text-danger-600 cursor-pointer'
          : 'hover:bg-gray-700 text-gray-300 cursor-pointer'
      } flex items-center justify-between rounded text-sm duration-100`}
      onClick={handleClick}
      disabled={disabled}
    >
      {showConfirmation ? (
        <TextField value="Confirm" icon={<CheckIcon />} />
      ) : (
        <span
          className={
            'overflow-x-hidden flex items-center justify-between w-full'
          }
        >
          <TextField value={text} icon={icon} className="ellipsis w-full" />
          {type === MenuItemType.REMOVABLE ? (
            <Button
              size={'small'}
              variant={'tertiary'}
              onlyIcon
              className="invisible group-hover:visible duration-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              title="Delete"
            >
              <TrashCan />
            </Button>
          ) : (
            ''
          )}
          {type === MenuItemType.SELECTABLE && selected ? <CheckIcon /> : ''}
        </span>
      )}
    </Comp>
  );

  return tooltip ? (
    <Tooltip text={tooltip} placement="top">
      {item}
    </Tooltip>
  ) : (
    item
  );
};
export default Item;
