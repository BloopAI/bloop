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
      className={`flex items-center justify-center gap-1 py-1 px-3 border border-gray-700 rounded-full ${
        variant === 'filled' ? 'bg-gray-700' : ''
      } caption`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default ChipButton;
