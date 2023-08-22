import React, { memo, useContext } from 'react';
import { DeviceContext } from '../../context/deviceContext';

type Props = {
  type: 'cmd' | 'entr' | string;
  variant?: 'primary' | 'secondary' | 'tertiary';
};

const KeyboardChip = ({ type, variant }: Props) => {
  const { os } = useContext(DeviceContext);
  return (
    <div
      className={`flex items-center justify-center p-1 h-4.5 rounded ${
        variant === 'primary'
          ? 'bg-bg-main-hover text-label-control'
          : variant === 'tertiary'
          ? 'bg-bg-shade text-label-base'
          : 'bg-bg-border text-label-base'
      } caption flex-shrink-0`}
    >
      {type === 'entr'
        ? '↵'
        : type === 'cmd'
        ? os.type === 'Darwin'
          ? '⌘'
          : 'Ctrl'
        : type}
    </div>
  );
};

export default memo(KeyboardChip);
