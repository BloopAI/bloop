import { memo } from 'react';
import SpinLoader from '../../icons/SpinLoader';

type Props = {
  sizeClassName?: string;
};

const SpinLoaderContainer = ({ sizeClassName }: Props) => {
  return (
    <div
      className={`${sizeClassName} animate-spin-slow flex-shrink-0 text-label-base`}
    >
      <SpinLoader raw />
    </div>
  );
};

export default SpinLoaderContainer;
