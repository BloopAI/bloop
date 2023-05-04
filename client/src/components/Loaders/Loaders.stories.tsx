import Bar from './BarLoader';
import CircleProgress from './CircleProgressLoader';
import Lite from './LiteLoader';
import Spin from './SpinLoader';
import Skeleton from './SkeletonLoader';
import ThreeDots from './ThreeDotsLoader';
import '../../index.css';

export default {
  title: 'components/Loaders',
  component: Spin,
};

export const BarLoader = () => {
  return (
    <div>
      <Bar percentage={33} />
    </div>
  );
};

export const CircleProgressLoader = () => {
  return (
    <div>
      <CircleProgress percent={33} />
    </div>
  );
};

export const LiteLoader = () => {
  return (
    <div className="text-label-title">
      <Lite />
    </div>
  );
};

export const SpinLoader = () => {
  return (
    <div className="flex flex-1 items-center justify-center h-screen">
      <Spin />
    </div>
  );
};

export const SkeletonLoader = () => {
  return (
    <div className="p-5 w-64">
      <Skeleton />
    </div>
  );
};

export const ThreeDotsLoader = () => {
  return (
    <div className="text-label-title">
      <ThreeDots />
    </div>
  );
};
