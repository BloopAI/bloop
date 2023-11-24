import React, { memo, useCallback } from 'react';
import { SettingsTypesSections } from '../../types/general';

type Props<T> = {
  type: T;
  label: string;
  isActive: boolean;
  handleClick: (t: T) => void;
};

const SectionButton = <T extends SettingsTypesSections>({
  type,
  label,
  handleClick,
  isActive,
}: Props<T>) => {
  const onClick = useCallback(() => {
    handleClick(type);
  }, [type]);
  return (
    <div className="w-full pl-4">
      <button
        onClick={onClick}
        className={`h-8 px-2 rounded-6 body-s-b flex items-center ${
          isActive ? 'bg-bg-shade text-label-title' : 'text-label-base'
        } w-full text-left`}
      >
        {label}
      </button>
    </div>
  );
};

export default memo(SectionButton) as typeof SectionButton;
