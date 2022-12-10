import { motion } from 'framer-motion';
import { Token } from '../../../types/prism';
import { Range } from '../../../types/results';

type Props = {
  token: Token;
  highlights?: Range[];
  highlight?: boolean;
  startHl?: boolean;
  endHl?: boolean;
};

const CodeToken = ({ token, highlight, startHl, endHl }: Props) => {
  return (
    <span
      data-byte-range={`${token.byteRange?.start}-${token.byteRange?.end}`}
      className={`token ${token.types.join(
        ' ',
      )}  transition-opacity duration-300`}
    >
      <motion.span
        layout="position"
        className={`${
          highlight
            ? `before:block before:absolute before:-inset-0.5 before:right-0 before:left-0 before:bg-secondary-500/25 relative`
            : ''
        } ${startHl ? 'before:rounded-l before:left-[-2px]' : ''} ${
          endHl ? 'before:rounded-r before:right-[-2px]' : ''
        }`}
      >
        {token.content}
      </motion.span>
    </span>
  );
};

export default CodeToken;
