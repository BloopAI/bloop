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
      className={`border-none bg-gray-900 hover:bg-gray-800 active: bg-gray-900 text-gray-500 
      hover:text-gray-100 justify-between flex w-full py-4 px-8 rounded-none focus:outline-none 
      items-center transition-all duration-300 ease-in-bounce outline-0 outline-none`}
    >
      <span className="flex items-center gap-2 subhead-s text-gray-300 hover:text-gray-300">
        {label}
        {numberSelected ? (
          <span className="w-5 h-5 bg-primary-400 rounded-4 flex items-center justify-center caption text-gray-100">
            {numberSelected}
          </span>
        ) : null}
      </span>
      {isOpen ? <ChevronUpFilled /> : <ChevronDownFilled />}
    </button>
  );
};

export default FilterTitle;
