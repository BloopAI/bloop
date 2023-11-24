import { memo } from 'react';

type Props = { text: string };

const SectionLabel = ({ text }: Props) => {
  return (
    <div className="flex h-8 px-2 gap-2 items-center rounded">
      <p className="text-label-base body-mini-b ellipsis">{text}</p>
    </div>
  );
};

export default memo(SectionLabel);
