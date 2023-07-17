import React, { MouseEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TextField from '../../TextField';
import { CheckIcon, TrashCan } from '../../../icons';
import Button from '../../Button';
import { MenuItemType } from '../../../types/general';
import Tooltip from '../../Tooltip';

export type ItemProps = {
  text: string | React.ReactElement;
  icon?: React.ReactElement;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  onMouseOver?: () => void;
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
  disabled,
  tooltip,
  onMouseOver,
}: ItemProps) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
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

  const item = (
    <button
      className={`p-2.5 group w-full text-left ${
        disabled
          ? 'text-label-muted cursor-default'
          : type === MenuItemType.DANGER
          ? 'hover:bg-bg-base-hover active:bg-transparent text-bg-danger cursor-pointer'
          : 'hover:bg-bg-base-hover active:bg-transparent text-label-base hover:text-label-title focus:text-label-title active:text-label-title cursor-pointer'
      } flex items-center justify-between rounded text-sm duration-100`}
      onClick={handleClick}
      disabled={disabled}
      onMouseOver={onMouseOver}
      onFocus={onMouseOver}
    >
      {showConfirmation ? (
        <TextField value={t('Confirm')} icon={<CheckIcon />} />
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
              title={t('Delete')}
            >
              <TrashCan />
            </Button>
          ) : (
            ''
          )}
          {type === MenuItemType.SELECTABLE && selected ? (
            <span className="w-5 h-5 text-bg-main">
              <CheckIcon />
            </span>
          ) : (
            ''
          )}
        </span>
      )}
    </button>
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
