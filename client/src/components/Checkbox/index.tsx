import { ReactNode } from 'react';
import { CheckIcon } from '../../icons';

type Props = {
  disabled?: boolean;
  intermediary?: boolean;
  checked: boolean;
  id?: string;
  label: string | ReactNode;
  description?: string;
  labelClassName?: string;
  onChange: (b: boolean) => void;
};

const Checkbox = ({
  disabled,
  checked,
  id,
  label,
  onChange,
  description,
  intermediary,
  labelClassName,
}: Props) => {
  return (
    <label
      className={`${
        disabled ? 'text-label-muted' : 'text-label-title cursor-pointer'
      } flex gap-2 ${
        description ? 'items-start' : 'items-center'
      } group-custom w-full focus:outline-none focus:outline-0 outline-none`}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
    >
      <div
        role="checkbox"
        tabIndex={0}
        id={id}
        className={`border ${
          checked || intermediary
            ? 'bg-bg-main text-label-control border-bg-main'
            : disabled
            ? 'text-transparent border-bg-base'
            : 'text-transparent group-custom-hover:text-bg-border-hover border-bg-border hover:border-bg-border-hover'
        } ${
          disabled
            ? 'bg-bg-base'
            : 'group-custom-active:text-label-control group-custom-active:bg-bg-main group-custom-active:border-bg-main group-custom-active:shadow-rings-blue'
        } w-4 h-4 flex flex-shrink-0 items-center justify-center rounded-sm relative ${
          description ? 'top-[2px]' : ''
        } transition-all duration-150 ease-in-bounce
         focus:outline-none focus:outline-0 outline-none`}
        aria-checked={checked}
      >
        {intermediary ? (
          <svg
            viewBox="0 0 8 2"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0 w-[8px] h-[2px]"
          >
            <path
              d="M1.17157 1H6.82843"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <CheckIcon raw />
        )}
      </div>
      <div className="flex flex-col gap-1 body-s w-full overflow-hidden">
        <span className={labelClassName}>{label}</span>
        {description ? (
          <span className={disabled ? 'text-label-muted' : 'text-label-base'}>
            {description}
          </span>
        ) : null}
      </div>
    </label>
  );
};

export default Checkbox;
