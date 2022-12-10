import { RegexIcon } from '../../icons';

type Props = {
  active: boolean;
  clasName?: string;
  onClick?: () => void;
};
const RegexButton = ({ active, clasName, onClick }: Props) => {
  return (
    <button
      onClick={onClick}
      className={`
       bg-transparent hover:text-gray-100 hover:bg-gray-700 active:text-gray-100 
      active:bg-sky-500 rounded-4 focus:outline-none outline-none outline-0 flex items-center p-1 
     flex-grow-0 flex-shrink-0 h-6 w-6 justify-center transition-all duration-150 ease-in-bounce select-none ${clasName}
     ${active ? 'bg-sky-500 text-gray-100 hover:bg-sky-600' : 'text-gray-500'}`}
    >
      <RegexIcon raw />
    </button>
  );
};
export default RegexButton;
