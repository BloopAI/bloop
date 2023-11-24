import React from 'react';
import TextField from '../../../../components/TextField';

type Props = {
  icon?: React.ReactElement;
  value: string;
  active?: boolean;
  dense?: boolean;
  variant?: 'default' | 'light';
  onClick?: () => void;
};

const colorsMap = {
  default: 'active:bg-bg-base-hover hover:bg-bg-base-hover',
  light: 'active:bg-bg-base-hover hover:bg-bg-base-hover',
};

const NavigationItem = ({
  icon,
  value,
  active = false,
  dense,
  variant = 'default',
  onClick,
}: Props) => {
  return (
    <span
      className={`${active ? 'text-label-title' : 'text-label-base'} ${
        !dense ? 'h-11.5 flex items-center' : ''
      } active:text-label-title transition-all duration-300 ease-in-bounce ${
        colorsMap[variant]
      } px-8 block py-2 cursor-pointer hover:text-label-title w-full`}
      onClick={onClick}
    >
      <TextField
        value={value}
        icon={icon}
        active={active}
        className={'ellipsis'}
      />
    </span>
  );
};

export default NavigationItem;
