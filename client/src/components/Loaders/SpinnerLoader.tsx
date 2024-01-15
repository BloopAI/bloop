import SpinLoader from '../../icons/SpinLoader';

type Props = {
  sizeClassName?: string;
  colorClassName?: string;
};

const SpinLoaderContainer = ({ sizeClassName, colorClassName }: Props) => {
  return (
    <div
      className={`${sizeClassName} animate-spin-slow flex-shrink-0 ${
        colorClassName || 'text-label-base'
      }`}
    >
      <SpinLoader raw />
    </div>
  );
};

export default SpinLoaderContainer;
