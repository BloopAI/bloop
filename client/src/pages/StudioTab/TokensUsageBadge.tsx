import { memo } from 'react';
import CodeStudioToken from '../../icons/CodeStudioToken';
import { humanNumber } from '../../utils';

type Props = {
  tokens: number;
};

const TokensUsageBadge = ({ tokens }: Props) => {
  return (
    <div className="flex h-6 pl-1 pr-2 items-center gap-1 bg-bg-shade rounded-full">
      <CodeStudioToken className="text-bg-danger" />
      <span className="caption text-label-title">{humanNumber(tokens)}</span>
    </div>
  );
};

export default memo(TokensUsageBadge);
