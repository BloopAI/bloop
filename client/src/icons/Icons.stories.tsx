import * as Icons from './index';
import '../index.css';

export default {
  title: 'Icons',
};

export const Default = () => {
  return (
    <div className="gap-4 grid grid-cols-5 justify-items-center justify-center text-gray-100 items-center overflow-auto bg-gray-900 h-screen pb-8">
      {Object.keys(Icons).map((k) => {
        // @ts-ignore
        const Icon = Icons[k];
        return (
          <span className="flex flex-col gap-1 items-center" key={k}>
            <Icon />
            {k}
          </span>
        );
      })}
    </div>
  );
};
