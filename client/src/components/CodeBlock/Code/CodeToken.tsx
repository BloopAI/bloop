import { PureComponent } from 'react';
import { Token } from '../../../types/prism';
import { Range } from '../../../types/results';

type Props = {
  token: Token;
  highlights?: Range[];
  highlight?: boolean;
  startHl?: boolean;
  endHl?: boolean;
};

class CodeToken extends PureComponent<Props> {
  render() {
    const { token, highlight, startHl, endHl } = this.props;
    return (
      <span
        data-byte-range={`${token.byteRange?.start}-${token.byteRange?.end}`}
        className={`token ${token.types
          .filter((t) => t !== 'table')
          .join(' ')}`}
      >
        <span
          className={`${highlight ? `bg-secondary-500/25 py-0.5` : ''} ${
            startHl ? 'rounded-l pl-[2px]' : ''
          } ${endHl ? 'rounded-r pr-[2px]' : ''}`}
        >
          {token.content}
        </span>
      </span>
    );
  }
}

export default CodeToken;
