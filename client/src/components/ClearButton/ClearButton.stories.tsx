import ClearButton from './index';
import '../../index.css';

export default {
  title: 'components/ClearButton',
  component: ClearButton,
};

export const Default = () => {
  return (
    <div className="gap-4 grid grid-cols-4-fit justify-items-start justify-center text-gray-100 items-center bg-gray-900">
      <ClearButton />
    </div>
  );
};
