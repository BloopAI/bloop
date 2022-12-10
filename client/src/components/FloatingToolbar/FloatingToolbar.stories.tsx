import FloatingToolbar from './index';
import '../../index.css';

export default {
  title: 'components/FloatingToolbar',
  component: FloatingToolbar,
};

export const Default = () => {
  return (
    <div className="bg-gray-900 flex gap-10 items-start">
      <FloatingToolbar position="left" />
      <FloatingToolbar position="center" />
      <FloatingToolbar position="right" />
    </div>
  );
};
