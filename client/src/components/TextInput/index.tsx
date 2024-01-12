import {
  ChangeEvent,
  ForwardedRef,
  forwardRef,
  HTMLInputTypeAttribute,
  KeyboardEvent,
  ReactElement,
  useRef,
} from 'react';
import { CheckIcon, MagnifyToolIcon, MailIcon } from '../../icons';
import ClearButton from './ClearButton';
import RegexButton from './RegexButton';

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
  type?: HTMLInputTypeAttribute;
  onSubmit?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onEscape?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  inputClassName?: string;
  forceClear?: boolean;
  noBorder?: boolean;
  startIcon?: ReactElement;
  endIcon?: ReactElement;
  size?: 'small' | 'medium' | 'large';
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

const sizesMap = {
  small: { label: 'body-mini-b', container: 'h-7 px-2' },
  medium: { label: 'body-s-b', container: 'h-8 pl-2.5 pr-2' },
  large: { label: 'body-s-b', container: 'h-9 pl-3 pr-2.5' },
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
    type,
    onSubmit,
    onBlur,
    multiline,
    autoFocus,
    inputClassName,
    forceClear,
    onEscape,
    startIcon,
    endIcon,
    noBorder,
    size = 'medium',
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

  return (
    <div
      className={`flex flex-col gap-2 w-full ${
        disabled ? 'text-label-base' : 'text-label-title'
      } body-base`}
    >
      {label || helperText ? (
        <div className={`flex justify-between items-center w-full`}>
          <label className={`${sizesMap[size].label}`}>{label}</label>
          <span className={`text-label-base caption`}>{helperText}</span>
        </div>
      ) : null}
      <div
        className={`group border border-bg-border rounded bg-bg-base ${
          multiline ? 'p-2' : sizesMap[size].container
        } flex box-border items-center transition-all duration-150 ease-in-out relative`}
      >
        {type === 'email' || type === 'search' || startIcon ? (
          <span
            className={`w-3.5 mr-2.5 flex items-center flex-shrink-0 ${
              disabled ? 'text-label-muted' : 'text-label-base'
            } group-hover:text-label-title group-focus-within:text-label-title transition-all duration-150 ease-in-out`}
          >
            {startIcon ||
              (type === 'email' ? (
                <MailIcon sizeClassName="w-3.5 h-3.5" />
              ) : (
                <MagnifyToolIcon sizeClassName="w-3.5 h-3.5" />
              ))}
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
            rows={6}
            onBlur={onBlur}
            autoComplete="off"
            spellCheck="false"
            className={`bg-transparent resize-none border-none focus:outline-none w-full 
            placeholder:text-label-muted disabled:placeholder:text-label-faint
            transition-all duration-150 ease-in-out outline-none outline-0`}
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
            onBlur={onBlur}
            autoComplete="off"
            spellCheck="false"
            className={`bg-transparent border-none focus:outline-none w-full
            transition-all duration-150 ease-in-out outline-none outline-0 ${inputClassName}
            placeholder:text-label-muted disabled:placeholder:text-label-faint`}
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
            <CheckIcon sizeClassName="w-5 h-5" />
          </span>
        ) : null}
        {endIcon}
      </div>
      {error ? <span className="text-red caption">{error}</span> : null}
    </div>
  );
});

export default TextInput;
