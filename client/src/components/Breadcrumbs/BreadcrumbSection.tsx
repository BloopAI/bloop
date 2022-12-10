import { MouseEvent, ReactElement } from 'react';
import { Range } from '../../types/results';

type Props = {
  href: string;
  icon?: ReactElement<any, any>;
  label: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  isLast?: boolean;
  highlight?: Range;
};

const BreadcrumbSection = ({
  href,
  icon,
  label,
  onClick,
  isLast,
  highlight,
}: Props) => {
  const getHighlight = () => {
    if (highlight) {
      const left = label.substring(0, highlight.start);
      const search = label.substring(highlight.start, highlight.end + 1);
      const right = label.substring(highlight.end + 1);
      return (
        <span>
          {left}
          <span className="before:block before:absolute before:-inset-0.5 before:right-0 before:left-0 before:bg-secondary-500/25 relative before:rounded-l before:left-[-1.5px] before:rounded-r before:right-[-2px]">
            {search}
          </span>
          {right}
        </span>
      );
    }
    return label;
  };
  return (
    <a
      href={href}
      className={`flex items-center gap-1 hover:text-sky-500 cursor-pointer active:text-sky-500 ${
        isLast ? 'text-gray-200' : 'text-gray-500'
      }  transition-all duration-300 ease-in-bounce flex-shrink-0`}
      onClick={onClick}
    >
      {icon}
      <span className="whitespace-nowrap">{getHighlight()}</span>
    </a>
  );
};

export default BreadcrumbSection;
