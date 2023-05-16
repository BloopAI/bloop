import { PropsWithChildren } from 'react';

type Props = {
  variant?: 'filled' | 'outlined';
  onClick?: () => void;
};

const ChipButton = ({
  children,
  variant,
  onClick,
}: PropsWithChildren<Props>) => {
  return (
    <button
      className={`flex items-center justify-center gap-1 py-1 px-3 rounded-full text-label-title ${
        variant === 'filled' ? 'bg-chat-bg-sub' : 'border border-chat-bg-border'
      } caption`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default ChipButton;
