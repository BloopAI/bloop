import { LiteLoaderIcon } from '../../icons';

type Props = {
  sizeClassName?: string;
};

const LiteLoaderContainer = ({ sizeClassName = 'w-5 h-5' }: Props) => {
  return (
    <div className={`${sizeClassName} animate-spin-slow flex-shrink-0`}>
      <LiteLoaderIcon raw />
    </div>
  );
};

export default LiteLoaderContainer;
