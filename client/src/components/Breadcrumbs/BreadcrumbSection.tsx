import { MouseEvent, ReactElement } from 'react';
import { Range } from '../../types/results';

type Props = {
  icon?: ReactElement<any, any>;
  label: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  isLast?: boolean;
  highlight?: Range;
  type: 'link' | 'button';
};

const typeMap = {
  link: {
    default: 'text-gray-500 hover:text-sky-500 active:text-sky-500',
    isLast: 'text-gray-200',
  },
  button: {
    default:
      'px-2 py-1 rounded-4 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-100',
    isLast: 'text-gray-100 px-2 py-1 rounded-4 bg-gray-800',
  },
};

const BreadcrumbSection = ({
  icon,
  label,
  onClick,
  isLast,
  highlight,
  type,
}: Props) => {
  const getHighlight = () => {
    if (highlight) {
      const left = label.substring(0, highlight.start);
      const search = label.substring(highlight.start, highlight.end + 1);
      const right = label.substring(highlight.end + 1);
      return (
        <span>
          {left}
          <span className="bg-secondary-500/25 rounded-4">{search}</span>
          {right}
        </span>
      );
    }
    return label;
  };
  return (
    <button
      className={`flex items-center gap-1 cursor-pointer ${
        isLast ? typeMap[type].isLast : typeMap[type].default
      } transition-all duration-300 ease-in-bounce flex-shrink-0`}
      onClick={onClick}
    >
      {icon}
      <span className="whitespace-nowrap">{getHighlight()}</span>
    </button>
  );
};

export default BreadcrumbSection;
