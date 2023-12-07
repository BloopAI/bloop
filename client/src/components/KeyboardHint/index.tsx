import { memo } from 'react';
import useShortcuts from '../../hooks/useShortcuts';

type Props = {
  shortcut: string;
};

const KeyboardHint = ({ shortcut }: Props) => {
  const key = useShortcuts([shortcut]);
  return (
    <div className="min-w-[1.25rem] h-5 flex items-center justify-center px-1 rounded bg-bg-base-hover body-mini text-label-base">
      {key}
    </div>
  );
};

export default memo(KeyboardHint);
