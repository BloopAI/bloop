const SkeletonItem = () => {
  return (
    <div
      className="w-full h-full animate-move-x-fast bg-skeleton rounded-2xl"
      style={{
        backgroundSize: '300% 100%',
      }}
    ></div>
  );
};
export default SkeletonItem;
