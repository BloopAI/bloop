const CircleProgressLoader = ({ percent }: { percent: number }) => {
  return (
    <div
      className={`progress-circle ${percent > 50 ? 'over50' : ''} p${Math.round(
        percent,
      )}`}
    >
      <div className="left-half-clipper">
        <div className="first50-bar"></div>
        <div className="value-bar"></div>
      </div>
    </div>
  );
};

export default CircleProgressLoader;
