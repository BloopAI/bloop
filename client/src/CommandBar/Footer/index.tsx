import { memo } from 'react';
import HintButton from './HintButton';

type Props = {
  hintText?: string;
  btns?: {
    label: string;
    shortcut?: string[];
  }[];
};

const CommandBarFooter = ({ hintText, btns }: Props) => {
  return (
    <div className="flex items-center gap-1 w-full py-2.5 pl-4 pr-3 border-t border-bg-border">
      <p className="text-label-base code-mini flex-1">{hintText}</p>
      {btns?.map((b) => <HintButton key={b.label} {...b} />)}
    </div>
  );
};

export default memo(CommandBarFooter);
