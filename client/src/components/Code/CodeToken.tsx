import { memo } from 'react';
import { Token } from '../../types/prism';
import { Range } from '../../types/results';

type Props = {
  token: Token;
  highlights?: Range[];
  highlight?: boolean;
  startHl?: boolean;
  endHl?: boolean;
  isHoverable?: boolean;
  onClick?: () => void;
};

const CodeToken = ({
  token,
  highlight,
  startHl,
  endHl,
  onClick,
  isHoverable,
}: Props) => {
  return (
    <span
      data-byte-range={`${token.byteRange?.start}-${token.byteRange?.end}`}
      className={`token ${isHoverable ? 'cursor-pointer' : ''} ${token.types
        .filter((t) => t !== 'table')
        .join(' ')}`}
      onClick={onClick}
    >
      <span
        className={`${highlight ? `bg-yellow/16 py-0.5` : ''} ${
          startHl ? 'rounded-l pl-[2px]' : ''
        } ${endHl ? 'rounded-r pr-[2px]' : ''}`}
      >
        {token.content}
      </span>
    </span>
  );
};

export default memo(CodeToken);
