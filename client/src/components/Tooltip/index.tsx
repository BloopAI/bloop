import React, { PropsWithChildren, useRef } from 'react';
import Tippy, { TippyProps } from '@tippyjs/react/headless';
import useShortcuts from '../../hooks/useShortcuts';

type Props = {
  text: string | React.ReactNode;
  shortcut?: string[];
  placement: TippyProps['placement'];
  delay?: TippyProps['delay'];
  wrapperClassName?: string;
  variant?: 'contrast' | 'standard';
  appendTo?: TippyProps['appendTo'];
};

const Tooltip = ({
  text,
  placement,
  children,
  delay,
  shortcut,
  wrapperClassName,
  variant = 'contrast',
  appendTo,
}: PropsWithChildren<Props>) => {
  const ref = useRef<HTMLDivElement>(null);
  const shortcutSymbols = useShortcuts(shortcut);

  return (
    <Tippy
      placement={placement}
      delay={delay}
      appendTo={appendTo}
      render={(attrs) => (
        <span
          {...attrs}
          className={`inline-flex items-center gap-1.5 flex-shrink-0 rounded ${
            variant === 'contrast'
              ? `w-fit h-6 bg-bg-contrast text-label-contrast pl-1.5 ${
                  shortcutSymbols ? 'pr-0.5' : 'pr-1.5'
                }`
              : 'bg-bg-shade text-label-base border border-bg-border p-3'
          } shadow-medium body-mini z-50`}
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
      <div ref={ref} className={wrapperClassName}>
        {children}
      </div>
    </Tippy>
  );
};
export default Tooltip;
