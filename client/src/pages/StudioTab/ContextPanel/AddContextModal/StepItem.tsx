import { memo, ReactElement } from 'react';

type Props = {
  text: string;
  icon?: ReactElement<any, any>;
  onClick?: () => void;
};

const StepItem = ({ text, icon, onClick }: Props) => {
  return (
    <button
      className={`flex h-6 items-center gap-1 px-1.5 min-w-[1.5rem] first:rounded-bl first:rounded-tl last:rounded-br last:rounded-tr bg-bg-base-hover caption text-label-base last:text-label-link ellipsis max-w-12`}
      onClick={onClick}
    >
      {icon}
      <span className="ellipsis">{text}</span>
    </button>
  );
};

export default memo(StepItem);
