import React, { MouseEvent, useState } from 'react';
import TextField from '../../TextField';
import { CheckIcon, TrashCan } from '../../../icons';
import Button from '../../Button';
import { MenuItemType } from '../../../types/general';

export type ItemProps = {
  text: string;
  href?: string;
  icon?: React.ReactElement;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  onDelete?: () => void;
  type: MenuItemType;
};

const Item = ({ onClick, text, icon, type, onDelete, href }: ItemProps) => {
  const [selected, setSelected] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
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

  return (
    <Comp
      className={`p-2.5 group hover:bg-gray-700 text-gray-300 flex items-center justify-between rounded cursor-pointer text-sm ${
        type === MenuItemType.DANGER ? 'text-danger-600' : ''
      }`}
      onClick={handleClick}
    >
      {showConfirmation ? (
        <>
          <TextField value="Confirm" icon={<CheckIcon />} />
        </>
      ) : (
        <span className={'overflow-x-hidden'}>
          <TextField value={text} icon={icon} />
          {type === MenuItemType.REMOVABLE ? (
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
          {type === MenuItemType.SELECTABLE && selected ? <CheckIcon /> : ''}
        </span>
      )}
    </Comp>
  );
};
export default Item;
