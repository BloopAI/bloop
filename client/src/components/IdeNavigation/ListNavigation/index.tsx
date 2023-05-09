import React from 'react';

import NavigationItem from '../NavigationItem';

type SeparateIcons = {
  items: { title: string; icon: React.ReactElement }[];
  icon?: React.ReactElement;
};

type GeneralIcon = {
  items: { title: string; icon?: React.ReactElement }[];
  icon: React.ReactElement;
};

type Props = {
  setSelected: (n: number) => void;
  title?: string;
  selected?: number;
  dense?: boolean;
  variant?: 'default' | 'light';
} & (SeparateIcons | GeneralIcon);

const colorsMap = {
  default: {
    default: 'text-label-base',
    selected: 'text-label-title bg-shade',
  },
  light: {
    default: 'text-label-base',
    selected: 'text-label-title bg-bg-base-hover',
  },
};

const ListNavigation = ({
  items,
  icon,
  title,
  selected,
  setSelected,
  dense,
  variant = 'default',
}: Props) => {
  return (
    <div className={`${!dense ? 'flex flex-col gap-2' : ''} select-none`}>
      {!!title && <span className="text-xs p-5 px-8">{title}</span>}
      {items.map((item, index) => (
        <span
          key={item.title}
          onClick={() => setSelected(index)}
          className={`block ${
            colorsMap[variant][selected === index ? 'selected' : 'default']
          } transition-all duration-300 ease-in-bounce`}
        >
          <NavigationItem
            value={item.title}
            icon={item.icon || icon}
            key={item.title}
            active={selected === index}
            dense={dense}
            variant={variant}
          />
        </span>
      ))}
    </div>
  );
};

export default ListNavigation;
