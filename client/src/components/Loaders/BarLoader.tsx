const BarLoader = ({ percentage }: { percentage: number }) => {
  return (
    <div className="w-full h-[3px] bg-gray-800 rounded-1 overflow-hidden">
      <div
        className="h-[3px] bg-primary-300 rounded-1 transition-all"
        style={{ width: percentage + '%' }}
      />
    </div>
  );
};

export default BarLoader;
