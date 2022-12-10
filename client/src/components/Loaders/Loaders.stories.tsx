import Spin from './SpinLoader';
import Skeleton from './SkeletonLoader';
import '../../index.css';

export default {
  title: 'components/Loaders',
  component: Spin,
};

export const SpinLoader = () => {
  return (
    <div className="bg-gray-900 flex flex-1 items-center justify-center h-screen">
      <Spin />
    </div>
  );
};

export const SkeletonLoader = () => {
  return (
    <div className="bg-gray-50 p-5 w-64">
      <Skeleton />
    </div>
  );
};
