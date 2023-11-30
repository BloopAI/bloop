import { memo } from 'react';

type Props = {
  text: string;
};

const SectionDivider = ({ text }: Props) => {
  return (
    <div className="flex items-center gap-1 px-2 py-1 body-mini-b text-label-muted">
      {text}
    </div>
  );
};

export default memo(SectionDivider);
