import React from 'react';
import TextField from '../../TextField';

type Props = {
  icon?: React.ReactElement;
  value: string;
  active?: boolean;
  dense?: boolean;
  variant: 'default' | 'light';
  onClick?: () => void;
};

const colorsMap = {
  default: 'active:bg-gray-800 hover:bg-gray-800',
  light: 'active:bg-gray-700 hover:bg-gray-700',
};

const NavigationItem = ({
  icon,
  value,
  active = false,
  dense,
  variant,
  onClick,
}: Props) => {
  return (
    <span
      className={`${active ? 'text-gray-300' : 'text-gray-500'} ${
        !dense ? 'h-11.5 flex items-center' : ''
      } active:text-gray-300 transition-all duration-300 ease-in-bounce ${
        colorsMap[variant]
      } px-8 block py-2 cursor-pointer hover:text-gray-300 w-full`}
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
