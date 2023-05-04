import * as Icons from './index';

export default {
  title: 'Icons',
};

export const Default = () => {
  return (
    <div className="gap-4 grid grid-cols-5 justify-items-center justify-center text-label-title items-center overflow-auto h-screen pb-8">
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
