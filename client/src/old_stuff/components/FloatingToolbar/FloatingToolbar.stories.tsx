import FloatingToolbar from './index';
export default {
  title: 'components/FloatingToolbar',
  component: FloatingToolbar,
};
export const Default = () => {
  return (
    <div className="flex gap-10 items-start">
      <FloatingToolbar position="left" />
      <FloatingToolbar position="center" />
      <FloatingToolbar position="right" />
    </div>
  );
};
