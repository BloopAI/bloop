const SkeletonItem = ({ roundedFull = true }: { roundedFull?: boolean }) => {
  return (
    <div
      className={`w-full h-full animate-move-x-fast bg-skeleton ${
        roundedFull ? 'rounded-2xl' : 'rounded-md'
      }`}
      style={{
        backgroundSize: '900px 100%',
      }}
    ></div>
  );
};
export default SkeletonItem;
