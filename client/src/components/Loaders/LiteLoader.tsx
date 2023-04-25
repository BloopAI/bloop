import { LiteLoader } from '../../icons';

const LiteLoaderContainer = () => {
  return (
    <div className="w-5 h-5 animate-spin-slow flex-shrink-0">
      <LiteLoader raw />
    </div>
  );
};

export default LiteLoaderContainer;
