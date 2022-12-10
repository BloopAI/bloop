import { ReactElement } from 'react';
import Checkbox from '../Checkbox';
import { CloseSign } from '../../icons';

type Props = {
  selected: boolean;
  checkbox?: boolean;
  label: string;
  onSelect: (b: boolean) => void;
  description: string;
  icon?: ReactElement;
};

const FilterItem = ({
  selected,
  label,
  onSelect,
  description,
  checkbox,
  icon,
}: Props) => {
  return checkbox ? (
    <Checkbox
      checked={selected}
      label={
        <span className="flex gap-2 items-center justify-between w-full caption text-gray-300 overflow-hidden flex-nowrap">
          <span className="flex items-center gap-2 w-full overflow-hidden">
            {icon}
            <span className="ellipsis w-full">{label}</span>
          </span>
          <span className="text-gray-500 caption flex-shrink-0">
            {description}
          </span>
        </span>
      }
      onChange={onSelect}
    />
  ) : (
    <button
      role="checkbox"
      className={`flex gap-2 items-center justify-between w-full focus:outline-none border-none p-1.5 rounded-4 body-s ${
        selected
          ? 'bg-primary-400 text-gray-100 pr-2.5'
          : 'bg-transparent text-gray-300'
      }`}
      onClick={() => onSelect(!selected)}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span
        className={`caption ${
          selected ? 'text-gray-100' : 'text-gray-500'
        } flex items-center gap-2`}
      >
        {description}
        {selected ? <CloseSign sizeClassName="w-3.5 h-3.5" /> : null}
      </span>
    </button>
  );
};

export default FilterItem;
