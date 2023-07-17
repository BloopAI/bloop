import { Trans } from 'react-i18next';
import { ChevronDownFilled, ChevronUpFilled } from '../../icons';

type Props = {
  label: string;
  numberSelected?: number;
  isOpen: boolean;
  handleToggle: () => void;
};

const FilterTitle = ({
  label,
  numberSelected,
  isOpen,
  handleToggle,
}: Props) => {
  return (
    <button
      onClick={handleToggle}
      className={`border-none hover:bg-base-hover active:bg-transparent text-label-muted
      hover:text-label-title justify-between flex w-full py-4 px-8 rounded-none focus:outline-none 
      items-center transition-all duration-300 ease-in-bounce outline-0 outline-none`}
    >
      <span className="flex items-center gap-2 subhead-s text-label-title">
        <Trans>{label}</Trans>
        {numberSelected ? (
          <span className="w-5 h-5 bg-bg-main rounded-4 flex items-center justify-center caption text-label-title">
            {numberSelected}
          </span>
        ) : null}
      </span>
      {isOpen ? <ChevronUpFilled /> : <ChevronDownFilled />}
    </button>
  );
};

export default FilterTitle;
