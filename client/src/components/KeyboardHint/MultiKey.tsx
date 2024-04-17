import { memo } from 'react';
import useShortcuts from '../../hooks/useShortcuts';

type Props = {
  shortcut: string[];
  variant?: 'outlined' | 'filled';
};

const MultiKeyHint = ({ shortcut, variant = 'filled' }: Props) => {
  const keys = useShortcuts(shortcut);

  return (
    <span
      className={`min-w-[1.25rem] h-5 inline-flex items-center justify-center px-1 rounded ${
        variant === 'filled'
          ? 'bg-bg-base-hover'
          : 'bg-bg-base border border-bg-border'
      } shadow-low body-mini text-label-base`}
    >
      {keys?.join(' ')}
    </span>
  );
};

export default memo(MultiKeyHint);
