const BarLoader = ({ percentage }: { percentage: number }) => {
  return (
    <div className="w-full h-[3px] bg-bg-shade rounded-1 overflow-hidden">
      <div
        className="h-[3px] bg-bg-main rounded-1 transition-all"
        style={{ width: percentage + '%' }}
      />
    </div>
  );
};

export default BarLoader;
