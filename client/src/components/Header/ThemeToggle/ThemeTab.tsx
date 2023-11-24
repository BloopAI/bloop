import { memo, MouseEvent, useCallback } from 'react';
import { Theme } from '../../../types';

type Props = {
  label: string;
  value: Theme;
  setTheme: (t: Theme) => void;
  isActive: boolean;
};

const ThemeTab = ({ label, setTheme, value, isActive }: Props) => {
  const onClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      setTheme(value);
    },
    [setTheme, value],
  );
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 h-6 px-1.5 items-center justify-center gap-1 rounded ${
        isActive
          ? 'bg-bg-base-hover shadow-medium text-label-title'
          : 'bg-transparent text-label-muted'
      } body-mini`}
    >
      {label}
    </button>
  );
};

export default memo(ThemeTab);
