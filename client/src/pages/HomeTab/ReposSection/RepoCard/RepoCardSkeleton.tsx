import SkeletonItem from '../../../../components/SkeletonItem';

const RepoCard = () => {
  return (
    <div className="bg-bg-base border border-bg-border rounded-md p-4 w-67 h-36 flex flex-col justify-between gap-6">
      <div className="flex items-center gap-4">
        <span className="h-11 w-11 flex items-center">
          <SkeletonItem roundedFull={false} />
        </span>
        <span className="w-full max-w-[124px] h-4">
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
