import { ReactNode } from 'react';

const IconWrapper =
  (icon: ReactNode) =>
  //eslint-disable-next-line
  ({ sizeClassName, className }: { raw?: boolean; sizeClassName?: string; className?: string }) =>
    sizeClassName ? (
      <span
        className={`${sizeClassName} inline-block flex-shrink-0 flex-grow-0 ${
          className || ''
        }`}
      >
        {icon}
      </span>
    ) : (
      <>{icon}</>
    );

export default IconWrapper;
