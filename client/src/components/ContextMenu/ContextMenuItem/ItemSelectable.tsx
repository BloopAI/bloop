import React from 'react';
import Checkbox from '../../Checkbox';

export type ItemProps = {
  text: string | React.ReactElement;
  icon?: React.ReactElement;
  onChange: (b: boolean) => void;
  disabled?: boolean;
  isSelected: boolean;
};

const Item = ({ text, icon, disabled, isSelected, onChange }: ItemProps) => {
  return (
    <div
      className={`p-2.5 group w-full text-left overflow-x-auto flex-shrink-0 ${
        disabled
          ? 'text-label-muted cursor-default'
          : 'text-label-base hover:text-label-title focus:text-label-title active:text-label-title cursor-pointer'
      } flex items-center justify-between rounded text-sm duration-100 relative`}
    >
      <Checkbox
        checked={isSelected}
        label={
          <span
            className="flex gap-1 items-center flex-shrink-0 overflow-x-auto text-label-base
          group-hover:text-label-title group-foxus:text-label-title caption-strong"
          >
            {icon}
            {text}
          </span>
        }
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
};
export default Item;
