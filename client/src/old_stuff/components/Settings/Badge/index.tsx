import { PropsWithChildren } from 'react';

type Props = {
  className?: string;
};

const Badge = ({ children, className }: PropsWithChildren<Props>) => {
  return (
    <span
      className={`bg-bg-danger px-1.5 rounded-4 caption text-label-title h-5 flex items-center ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
