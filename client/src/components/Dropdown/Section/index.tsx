import { memo, PropsWithChildren } from 'react';

type Props = {};

const DropdownSection = ({ children }: PropsWithChildren<Props>) => {
  return <div className="flex flex-col p-1 items-start">{children}</div>;
};

export default memo(DropdownSection);
