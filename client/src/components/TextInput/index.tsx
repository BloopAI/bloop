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
  noBorder?: boolean;
  startIcon?: ReactElement;
  endIcon?: ReactElement;
  height?: 'small' | 'medium' | 'high';
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
      'border-transparent hover:border-bg-border-hover focus-within:border-bg-border-hover',
    error: 'border-bg-danger',
    success: 'border-bg-border-hover',
    disabled: 'border-bg-base',
  },
  outlined: {
    default:
      'border-bg-border hover:border-bg-border-hover focus-within:border-bg-border-hover',
    error: 'border-bg-danger',
    success: 'border-bg-border-hover',
    disabled: 'border-bg-base',
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
    noBorder,
    height = 'medium',
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
        disabled ? 'text-label-base' : 'text-label-title'
      } body-s`}
    >
      {label || helperText ? (
        <div className="flex justify-between items-center w-full">
          <label>{label}</label>
          <span className={`text-label-base caption`}>{helperText}</span>
        </div>
      ) : null}
      <div
        className={`group ${noBorder ? '' : 'border'} ${
          height === 'high'
            ? 'h-12 rounded-xl'
            : multiline
            ? 'p-2 rounded'
            : height === 'small'
            ? 'h-8 rounded'
            : 'h-10 rounded'
        } flex box-border items-center ${
          noBorder
            ? ''
            : disabled
            ? borderMap[variant].disabled
            : error
            ? borderMap[variant].error
            : success
            ? borderMap[variant].success
            : borderMap[variant].default
        } ${disabled || variant === 'filled' || success ? 'bg-bg-base' : ''} ${
          variant === 'filled' ? 'hover:bg-bg-base-hover' : ''
        } transition-all duration-300 ease-in-bounce relative`}
      >
        {type === 'email' || type === 'search' || startIcon ? (
          <span
            className={`w-5 mx-2.5 flex items-center flex-shrink-0 ${
              disabled ? 'text-label-muted' : 'text-label-base'
            } group-hover:text-label-title group-focus-within:text-label-title transition-all duration-300 ease-in-bounce`}
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
            group-focus-within:placeholder:text-label-title group-hover:placeholder:text-label-title 
            disabled:placeholder:text-label-muted placeholder:text-label-base
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
                ? 'pr-2.5'
                : 'px-2.5'
            } transition-all duration-300 ease-in-bounce outline-none outline-0 ${inputClassName}
            placeholder:text-label-base disabled:placeholder:text-label-muted
            group-focus-within:placeholder:text-label-title group-hover:placeholder:text-label-title
            placeholder:transition-all placeholder:duration-300 placeholder:ease-in-bounce`}
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
            className="w-5 mr-2.5 flex items-center group-focus-within:hidden text-bg-success right-0
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
      {error ? <span className="text-bg-danger caption">{error}</span> : null}
    </div>
  );
});

export default TextInput;
