import React, { memo } from 'react';
import KeyboardChip from '../KeyboardChip';

type Props = {
  keyboardKeys: string[];
  label: string;
};

const CommandIndicator = ({ keyboardKeys, label }: Props) => {
  return (
    <div className="flex items-center gap-1.5">
      {keyboardKeys.map((k) => (
        <KeyboardChip type={k} key={k} />
      ))}
      <span className="caption text-label-base">{label}</span>
    </div>
  );
};

export default memo(CommandIndicator);
