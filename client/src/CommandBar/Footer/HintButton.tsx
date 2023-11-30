import { memo } from 'react';
import useShortcuts from '../../hooks/useShortcuts';

type Props = {
  label: string;
  shortcut?: string[];
};

const HintButton = ({ label, shortcut }: Props) => {
  const shortcutKeys = useShortcuts(shortcut);
  return (
    <div className="inline-flex pl-2 py-1 pr-1 items-center gap-1 rounded-6 bg-bg-base body-mini-b text-label-muted text-center">
      {label}
      {shortcutKeys?.map((k) => (
        <div
          key={k}
          className="w-5 h-5 px-1 flex items-center justify-center rounded bg-bg-base-hover"
        >
          {k}
        </div>
      ))}
    </div>
  );
};

export default memo(HintButton);
