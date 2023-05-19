type Props = {
  label?: string;
  description?: string;
  progress: number;
};

const ProgressBar = ({ label, description, progress }: Props) => {
  return (
    <div className="flex flex-col gap-2">
      {!!label && <p className="body-s">{label}</p>}
      <div className="bg-bg-base h-[3px] rounded-px">
        <div
          className="h-[3px] bg-bg-main-hover rounded-px transition-all ease-in-slow duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {!!description && <p className="caption">{description}</p>}
    </div>
  );
};

export default ProgressBar;
