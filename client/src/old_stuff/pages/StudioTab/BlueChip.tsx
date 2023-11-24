import { memo, ReactElement } from 'react';

type Props = {
  text: string | ReactElement;
};

const BlueChip = ({ text }: Props) => {
  return (
    <div className="h-5 px-1 flex items-center rounded-sm bg-bg-main/15 caption text-bg-main flex-shrink-0 w-fit select-none">
      {text}
    </div>
  );
};

export default memo(BlueChip);
