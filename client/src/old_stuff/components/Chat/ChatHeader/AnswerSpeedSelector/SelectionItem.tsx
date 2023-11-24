import { memo, ReactElement, MouseEvent } from 'react';
import { Checkmark } from '../../../../../icons';

type Props = {
  icon: ReactElement;
  isSelected: boolean;
  title: string;
  description: string;
  onClick: (e: MouseEvent) => void;
};

const SelectionItem = ({
  icon,
  isSelected,
  title,
  description,
  onClick,
}: Props) => {
  return (
    <button
      className={`flex gap-2 p-2 items-stretch justify-start rounded hover:bg-bg-base-hover group-summary text-left`}
      onClick={onClick}
    >
      {icon}
      <div className="flex flex-col flex-1 gap-1">
        <p className={`body-s-strong text-label-title`}>{title}</p>
        <p className={`body-s text-label-base`}>{description}</p>
      </div>
      <Checkmark
        className={`text-label-link ${isSelected ? '' : 'opacity-0'}`}
      />
    </button>
  );
};

export default memo(SelectionItem);
