import ClearButton from './index';

export default {
  title: 'components/ClearButton',
  component: ClearButton,
};

export const Default = () => {
  return (
    <div className="gap-4 grid grid-cols-4-fit justify-items-start justify-center items-center">
      <ClearButton />
    </div>
  );
};
