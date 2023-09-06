import React, { memo, useContext } from 'react';
import { DeviceContext } from '../../context/deviceContext';

type Props = {
  type: 'cmd' | 'entr' | string;
  variant?: 'primary' | 'secondary' | 'secondary-light' | 'tertiary' | 'danger';
  size?: 'small' | 'medium';
};

const variantsMap = {
  primary: 'bg-bg-main-hover text-label-control',
  secondary: 'bg-bg-border text-label-base',
  'secondary-light': 'bg-bg-border text-label-controll',
  tertiary: 'bg-bg-shade text-label-base',
  danger: 'bg-bg-danger-hover text-label-control',
};

const KeyboardChip = ({
  type,
  variant = 'secondary',
  size = 'medium',
}: Props) => {
  const { os } = useContext(DeviceContext);
  return (
    <span
      className={`flex items-center justify-center p-1 ${
        size === 'small' ? 'h-3.5' : 'h-4.5'
      } rounded ${variantsMap[variant]} caption-strong flex-shrink-0`}
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
