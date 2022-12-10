import { ReactNode } from 'react';

const IconWrapper =
  (rawIcon: ReactNode, boxedIcon: ReactNode) =>
  //eslint-disable-next-line
  ({ raw, sizeClassName }: { raw?: boolean; sizeClassName?: string }) =>
    raw ? (
      <>{rawIcon}</>
    ) : (
      <span
        className={`${
          sizeClassName || 'w-5 h-5'
        } inline-block flex-shrink-0 flex-grow-0`}
      >
        {boxedIcon}
      </span>
    );

export default IconWrapper;
