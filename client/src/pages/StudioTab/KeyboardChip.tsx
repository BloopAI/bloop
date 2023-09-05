import React, { memo, useContext } from 'react';
import { DeviceContext } from '../../context/deviceContext';

type Props = {
  type: 'cmd' | 'entr' | string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
};

const variantsMap = {
  primary: 'bg-bg-main-hover text-label-control',
  secondary: 'bg-bg-border text-label-base',
  tertiary: 'bg-bg-shade text-label-base',
  danger: 'bg-bg-danger-hover text-label-control',
};

const KeyboardChip = ({ type, variant = 'secondary' }: Props) => {
  const { os } = useContext(DeviceContext);
  return (
    <span
      className={`flex items-center justify-center p-1 h-4.5 rounded ${variantsMap[variant]} caption flex-shrink-0`}
    >
      {type === 'entr'
        ? '↵'
        : type === 'cmd'
        ? os.type === 'Darwin'
          ? '⌘'
          : 'Ctrl'
        : type}
    </span>
  );
};

export default memo(KeyboardChip);
