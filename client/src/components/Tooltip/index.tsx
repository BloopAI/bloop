import React, { PropsWithChildren, useRef } from 'react';
import Tippy, { TippyProps } from '@tippyjs/react/headless';
import useShortcuts from '../../hooks/useShortcuts';

type Props = {
  text: string | React.ReactNode;
  shortcut?: string[];
  placement: TippyProps['placement'];
  delay?: TippyProps['delay'];
};

const Tooltip = ({
  text,
  placement,
  children,
  delay,
  shortcut,
}: PropsWithChildren<Props>) => {
  const ref = useRef<HTMLDivElement>(null);
  const shortcutSymbols = useShortcuts(shortcut);

  return (
    <Tippy
      placement={placement}
      delay={delay}
      render={(attrs) => (
        <span
          {...attrs}
          className={`w-fit h-6 inline-flex items-center gap-1.5 pl-1.5 ${
            shortcutSymbols ? 'pr-0.5' : 'pr-1.5'
          } flex-shrink-0 rounded bg-bg-contrast shadow-medium body-mini text-label-contrast z-50`}
        >
          {text}
          {!!shortcutSymbols && (
            <span
              className={`inline-flex h-5 px-1 flex-shrink-0 items-center justify-center gap-1 
              rounded border border-bg-border bg-bg-base shadow-low text-label-base body-mini`}
            >
              {shortcutSymbols.join(' ')}
            </span>
          )}
        </span>
      )}
    >
      <div ref={ref}>{children}</div>
    </Tippy>
  );
};
export default Tooltip;
