import { MouseEvent, ReactElement } from 'react';
import { Range } from '../../types/results';

type HighlightedString = {
  label: string;
  highlight?: Range;
};

type ItemElement = {
  label: ReactElement<any, any>;
  highlight?: never;
};

type Props = {
  icon?: ReactElement<any, any>;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  isLast?: boolean;
  limitSectionWidth?: boolean;
  type: 'link' | 'button';
} & (HighlightedString | ItemElement);

const typeMap = {
  link: {
    default: 'text-label-base hover:text-bg-main active:text-bg-main',
    isLast: 'text-label-title',
  },
  button: {
    default:
      'px-2 py-1 rounded-4 hover:bg-bg-base-hover text-label-base hover:text-label-title',
    isLast: 'text-label-base px-2 py-1 rounded-4',
  },
};

const BreadcrumbSection = ({
  icon,
  label,
  onClick,
  isLast,
  highlight,
  type,
  limitSectionWidth,
}: Props) => {
  const getHighlight = () => {
    if (highlight) {
      const left = label.substring(0, highlight.start);
      const search = label.substring(highlight.start, highlight.end + 1);
      const right = label.substring(highlight.end + 1);
      return (
        <span>
          {left}
          <span className="bg-bg-highlight/25 rounded-4 text-label-base">
            {search}
          </span>
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
      } ${
        limitSectionWidth ? 'max-w-[8rem] ellipsis' : ''
      } transition-all duration-300 ease-in-bounce flex-shrink-0`}
      onClick={onClick}
    >
      {icon}
      <span
        className={`whitespace-nowrap ${limitSectionWidth ? 'ellipsis' : ''}`}
      >
        {getHighlight()}
      </span>
    </button>
  );
};

export default BreadcrumbSection;
