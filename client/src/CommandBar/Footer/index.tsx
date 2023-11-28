import { memo, useContext } from 'react';
import { CommandBarContext } from '../../context/commandBarContext';
import HintButton from './HintButton';

type Props = {};

const CommandBarFooter = ({}: Props) => {
  const { focusedItem } = useContext(CommandBarContext.FooterValues);
  return (
    <div className="flex items-center gap-1 w-full py-2.5 pl-4 pr-3 border-t border-bg-border">
      <p className="text-label-base code-mini flex-1">
        {focusedItem?.footerHint}
      </p>
      {focusedItem?.footerBtns?.map((b) => <HintButton key={b.label} {...b} />)}
    </div>
  );
};

export default memo(CommandBarFooter);
