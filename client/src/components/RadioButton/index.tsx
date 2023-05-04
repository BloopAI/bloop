import { ChangeEvent } from 'react';

type Props = {
  title: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  name: string;
  value: string;
  description?: string;
};

const RadioButton = ({
  title,
  checked,
  onChange,
  name,
  value,
  description,
}: Props) => {
  return (
    <label className="cursor-pointer flex gap-2 group items-start" tabIndex={0}>
      <input
        type="radio"
        className="hidden"
        checked={checked}
        onChange={onChange}
        name={name}
        value={value}
      />
      <span
        className={`border border-bg-border rounded-full w-4 h-4 inline-block  ${
          checked ? 'bg-bg-main text-label-control' : 'text-label-muted'
        } flex items-center justify-center transition-all flex-shrink-0 relative top-0.5`}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${
            checked ? '' : 'invisible group-hover:visible group-focus:visible'
          } transition-all`}
        >
          <circle cx="4" cy="4" r="4" fill="currentColor" />
        </svg>
      </span>
      <div className="flex flex-col gap-1">
        <span className="body-s text-label-title">{title}</span>
        {description ? (
          <span className="body-s text-label-muted">{description}</span>
        ) : null}
      </div>
    </label>
  );
};

export default RadioButton;
