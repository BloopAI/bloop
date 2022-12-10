const SkeletonLoader = () => {
  return (
    <div className="w-full h-4 overflow-hidden rounded-full">
      <div className="h-4 w-96 bg-skeleton animate-move-x" />
    </div>
  );
};

export default SkeletonLoader;
