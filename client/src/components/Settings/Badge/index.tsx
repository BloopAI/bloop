import { PropsWithChildren } from 'react';

type Props = {
  className?: string;
};

const Badge = ({ children, className }: PropsWithChildren<Props>) => {
  return (
    <span
      className={`bg-danger-600 px-1.5 rounded-4 caption text-gray-100 h-5 flex items-center ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
