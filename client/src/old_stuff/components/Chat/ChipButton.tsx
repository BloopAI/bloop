import React, { PropsWithChildren } from 'react';

type Props = {
  variant?: 'filled' | 'outlined';
  onClick?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  colorScheme?: 'chat' | 'base';
};

const ChipButton = ({
  children,
  variant,
  onClick,
  colorScheme = 'chat',
}: PropsWithChildren<Props>) => {
  return (
    <button
      className={`flex items-center justify-center gap-1 py-1 px-3 h-7 rounded-full text-label-title ${
        variant === 'filled'
          ? colorScheme === 'chat'
            ? 'bg-chat-bg-sub'
            : 'bg-bg-sub'
          : 'border border-chat-bg-border'
      } caption`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default ChipButton;
