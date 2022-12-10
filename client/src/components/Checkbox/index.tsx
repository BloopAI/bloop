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
        disabled ? 'text-gray-500' : 'text-gray-100 cursor-pointer'
      } flex gap-2 ${
        description ? 'items-start' : 'items-center'
      } group-custom w-full overflow-hidden`}
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
        className={`${
          checked || intermediary
            ? 'bg-primary-400 text-gray-100'
            : disabled
            ? 'text-transparent border border-gray-600 '
            : 'text-transparent group-custom-hover:text-gray-600 border border-gray-600 '
        } ${
          disabled
            ? 'bg-gray-800'
            : 'group-custom-active:text-gray-100 group-custom-active:bg-primary-400 group-custom-active:shadow-rings-blue'
        } w-4 h-4 p-1 flex flex-shrink-0 items-center rounded-sm relative ${
          description ? 'top-[2px]' : ''
        } transition-all duration-150 ease-in-bounce`}
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
          <span className="text-gray-500">{description}</span>
        ) : null}
      </div>
    </label>
  );
};

export default Checkbox;
