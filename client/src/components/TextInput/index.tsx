import {
  ChangeEvent,
  ForwardedRef,
  forwardRef,
  HTMLInputTypeAttribute,
  KeyboardEvent,
  ReactElement,
  useRef,
} from 'react';
import { CheckIcon, MagnifyTool, MailIcon } from '../../icons';
import ClearButton from '../ClearButton';
import RegexButton from '../RegexButton';

type Props = {
  value: string;
  placeholder?: string;
  label?: string;
  helperText?: string;
  id?: string;
  name: string;
  error?: string | null;
  success?: boolean;
  disabled?: boolean;
  regex?: boolean;
  variant?: 'outlined' | 'filled';
  type?: HTMLInputTypeAttribute;
  onSubmit?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onEscape?: () => void;
  onRegexClick?: () => void;
  validate?: () => void;
  regexEnabled?: boolean;
  autoFocus?: boolean;
  inputClassName?: string;
  forceClear?: boolean;
  high?: boolean;
  startIcon?: ReactElement;
  endIcon?: ReactElement;
};

type SingleLineProps = Props & {
  multiline?: false;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
};

type MultilineProps = Props & {
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  multiline: true;
};

const borderMap = {
  filled: {
    default:
      'border-transparent hover:border-gray-500 focus-within:border-gray-500',
    error: 'border-danger-500',
    disabled: 'border-gray-700',
  },
  outlined: {
    default:
      'border-gray-700 hover:border-gray-500 focus-within:border-gray-500',
    error: 'border-danger-500',
    disabled: 'border-gray-700',
  },
};

const TextInput = forwardRef(function TextInputWithRef(
  {
    value,
    onChange,
    placeholder,
    label,
    helperText,
    id,
    name,
    error,
    success,
    disabled,
    variant = 'outlined',
    type,
    onSubmit,
    validate,
    regex,
    onRegexClick,
    regexEnabled,
    multiline,
    autoFocus,
    inputClassName,
    forceClear,
    onEscape,
    startIcon,
    endIcon,
    high,
  }: Props & (SingleLineProps | MultilineProps),
  ref: ForwardedRef<HTMLInputElement>,
) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEnter = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit(e);
    } else if (e.key === 'Escape' && onEscape) {
      e.stopPropagation();
      onEscape();
    }
  };

  const handleRegex = () => {
    onRegexClick?.();
  };

  return (
    <div
      className={`flex flex-col gap-1 w-full ${
        disabled ? 'text-gray-500' : 'text-gray-100'
      } body-s`}
    >
      {label || helperText ? (
        <div className="flex justify-between items-center w-full">
          <label>{label}</label>
          <span
            className={`${
              disabled ? 'text-gray-500' : 'text-gray-400'
            } caption`}
          >
            {helperText}
          </span>
        </div>
      ) : null}
      <div
        className={`group border ${
          high ? 'h-12 rounded-xl' : multiline ? 'p-2 rounded' : 'h-10 rounded'
        } flex box-border items-center ${
          disabled
            ? borderMap[variant].disabled
            : error
            ? borderMap[variant].error
            : borderMap[variant].default
        } ${
          disabled
            ? 'bg-transparent '
            : variant === 'filled'
            ? 'bg-gray-800'
            : ''
        } transition-all duration-300 ease-in-bounce relative`}
      >
        {type === 'email' || type === 'search' || startIcon ? (
          <span
            className={`w-5 mx-2.5 ${
              disabled ? 'text-gray-500' : 'text-gray-400'
            } flex items-center group-focus-within:text-gray-100 flex-shrink-0 transition-all duration-300 ease-in-bounce`}
          >
            {startIcon || (type === 'email' ? <MailIcon /> : <MagnifyTool />)}
          </span>
        ) : null}
        {multiline ? (
          <textarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            id={id}
            name={name}
            disabled={disabled}
            rows={4}
            onBlur={validate}
            autoComplete="off"
            spellCheck="false"
            className={`bg-transparent resize-none border-none focus:outline-none w-full 
            group-focus-within:placeholder:text-gray-100 disabled:placeholder:text-gray-500 
            transition-all duration-300 ease-in-bounce outline-none outline-0`}
            onKeyDown={handleEnter}
          />
        ) : (
          <input
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            id={id}
            name={name}
            type={type}
            disabled={disabled}
            ref={ref || inputRef}
            onBlur={validate}
            autoComplete="off"
            spellCheck="false"
            className={`bg-transparent border-none focus:outline-none w-full  ${
              type === 'email' || type === 'search' || startIcon
                ? 'px-1'
                : 'pl-2.5'
            } transition-all duration-300 ease-in-bounce outline-none outline-0 pr-9 ${inputClassName}
            group-focus-within:placeholder:text-gray-100 disabled:placeholder:text-gray-500`}
            onKeyDown={handleEnter}
            autoFocus={autoFocus}
          />
        )}
        {(value || forceClear) && !multiline && !endIcon ? (
          <ClearButton
            tabIndex={-1}
            onClick={() => {
              if (!value && onEscape) {
                onEscape();
              } else {
                onChange({
                  target: { value: '', name },
                } as ChangeEvent<HTMLInputElement>);
                // @ts-ignore
                (ref || inputRef).current?.focus();
              }
            }}
            className={success ? 'group-focus-within:flex hidden' : 'flex'}
          />
        ) : null}
        {success ? (
          <span
            className="w-5 mr-2.5 flex items-center group-focus-within:hidden text-success-700 right-0
          top-1/2 -translate-y-1/2 absolute"
          >
            <CheckIcon />
          </span>
        ) : null}
        {endIcon}
        {regex ? (
          <RegexButton
            onClick={handleRegex}
            clasName={'mr-2'}
            active={!!regexEnabled}
          />
        ) : (
          ''
        )}
      </div>
      {error ? <span className="text-danger-500 caption">{error}</span> : null}
    </div>
  );
});

export default TextInput;
