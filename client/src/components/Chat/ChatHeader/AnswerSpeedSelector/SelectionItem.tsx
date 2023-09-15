import { memo, ReactElement, MouseEvent } from 'react';
import { Checkmark } from '../../../../icons';

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
      className={`flex gap-2 p-2 items-stretch justify-start rounded hover:bg-chat-bg-base-hover group-summary ${
        isSelected
          ? 'text-label-link'
          : 'text-label-base hover:text-label-title'
      } text-left`}
      onClick={onClick}
    >
      {icon}
      <div className="flex flex-col flex-1 gap-1">
        <p className={`body-s`}>{title}</p>
        <p
          className={`body-s ${
            isSelected
              ? 'text-label-base'
              : 'text-label-muted group-summary-hover:text-label-base'
          }`}
        >
          {description}
        </p>
      </div>
      <Checkmark className={isSelected ? '' : 'opacity-0 text-label-link'} />
    </button>
  );
};

export default memo(SelectionItem);
