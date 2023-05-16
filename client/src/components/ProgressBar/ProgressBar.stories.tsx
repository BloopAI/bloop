import ProgressBar from './index';

export default {
  title: 'components/ProgressBar',
  component: ProgressBar,
};

export const Empty = () => {
  return (
    <div className="w-98">
      <ProgressBar
        label="Add label"
        description="0% · 3 minutes remaining"
        progress={0}
      />
    </div>
  );
};

export const Start = () => {
  return (
    <div className="w-98">
      <ProgressBar
        label="Add label"
        description="3% · 3 minutes remaining"
        progress={3}
      />
    </div>
  );
};

export const Half = () => {
  return (
    <div className="w-98">
      <ProgressBar
        label="Add label"
        description="50% · 2 minutes remaining"
        progress={50}
      />
    </div>
  );
};

export const Full = () => {
  return (
    <div className="w-98">
      <ProgressBar
        label="Add label"
        description="100% · 1 second remaining"
        progress={100}
      />
    </div>
  );
};
