import { memo, ReactElement } from 'react';

type Props = {
  name: string;
  endIcon?: ReactElement;
  isActive?: boolean;
  onClick: () => void;
};

const TabButton = ({ name, endIcon, isActive, onClick }: Props) => {
  return (
    <button
      className={`flex items-center gap-1 px-2 rounded border ${
        isActive
          ? 'text-label-title border-bg-border bg-bg-shade'
          : 'text-label-base border-transparent'
      } shadow-low caption transition-all duration-150 ease-in-out`}
      onClick={onClick}
    >
      {name}
      {endIcon}
    </button>
  );
};

export default memo(TabButton);
