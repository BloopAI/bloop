import { memo } from 'react';
import { CheckIcon } from '../../icons';

type Props = {
  text: string;
};

const BenefitItem = ({ text }: Props) => {
  return (
    <div className="flex items-center gap-2">
      <CheckIcon sizeClassName="w-3.5 h-3.5" className="text-brand-default" />
      <p className="body-s text-label-base">{text}</p>
    </div>
  );
};

export default memo(BenefitItem);
