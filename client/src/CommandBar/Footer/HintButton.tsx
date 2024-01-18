import { ForwardedRef, forwardRef, memo } from 'react';
import useShortcuts from '../../hooks/useShortcuts';

type Props = {
  label: string;
  shortcut?: string[];
};

const HintButton = forwardRef(
  ({ label, shortcut }: Props, ref: ForwardedRef<HTMLDivElement>) => {
    const shortcutKeys = useShortcuts(shortcut);
    return (
      <div
        className="inline-flex pl-2 py-1 pr-1 items-center gap-1 rounded-6 bg-bg-base body-mini-b text-label-muted text-center"
        ref={ref}
      >
        {label}
        {shortcutKeys?.map((k) => (
          <div
            key={k}
            className="min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded bg-bg-base-hover"
          >
            {k}
          </div>
        ))}
      </div>
    );
  },
);

HintButton.displayName = 'HintButtonWithRef';

export default memo(HintButton);
