import { memo, PropsWithChildren } from 'react';

type Props = {
  borderBottom?: boolean;
};

const DropdownSection = ({
  children,
  borderBottom,
}: PropsWithChildren<Props>) => {
  return (
    <div
      className={`flex flex-col p-1 items-start ${
        borderBottom ? 'border-b border-bg-border' : ''
      }`}
    >
      {children}
    </div>
  );
};

export default memo(DropdownSection);
