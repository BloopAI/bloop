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
       hover:text-label-title active:text-label-title
      rounded-4 focus:outline-none outline-none outline-0 flex items-center p-1 
     flex-grow-0 flex-shrink-0 h-6 w-6 justify-center transition-all duration-150 ease-in-bounce select-none ${clasName}
     ${
       active
         ? 'bg-bg-main text-label-title hover:bg-bg-main'
         : 'bg-transparent hover:bg-bg-base text-label-muted'
     }`}
    >
      <RegexIcon raw sizeClassName="h-3 w-3" />
    </button>
  );
};
export default RegexButton;
