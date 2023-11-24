import { memo } from 'react';

type Props = { text: string };

const CommandBarChipItem = ({ text }: Props) => {
  return (
    <div className="flex px-1 gap-1 items-center rounded bg-bg-border code-mini text-label-base ellipsis">
      {text}
    </div>
  );
};

export default memo(CommandBarChipItem);
