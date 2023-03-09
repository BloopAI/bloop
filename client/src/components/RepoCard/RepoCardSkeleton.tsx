import SkeletonItem from '../SkeletonItem';

const RepoCard = () => {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-md p-4 w-full flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="h-11 w-11 flex items-center">
          <SkeletonItem roundedFull={false} />
        </span>
        <span className="w-full max-w-[124px] h-4">
          <SkeletonItem />
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <span className="w-full max-w-[226px] h-3">
          <SkeletonItem />
        </span>
        <span className="w-full max-w-[163px] h-3">
          <SkeletonItem />
        </span>
        <span className="w-full max-w-[226px] h-3">
          <SkeletonItem />
        </span>
      </div>
      <span className="w-full max-w-[163px] h-3">
        <SkeletonItem />
      </span>
    </div>
  );
};

export default RepoCard;
