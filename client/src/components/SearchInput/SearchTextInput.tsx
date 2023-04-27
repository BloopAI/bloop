import {
  ChangeEvent,
  ForwardedRef,
  forwardRef,
  HTMLInputTypeAttribute,
  KeyboardEvent,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
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
  onRegexClick?: () => void;
  validate?: () => void;
  regexEnabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
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

const SearchTextInput = forwardRef(function TextInputWithRef(
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
  }: Props,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current!);
  const [composing, setComposition] = useState(false);
  const startComposition = () => setComposition(true);
  const endComposition = () => setComposition(false);

  const handleEnter = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Enter' && onSubmit) {
      if (composing) return;
      e.preventDefault();
      onSubmit(e);
    }
    if (e.key === 'Escape' && !value) {
      e.stopPropagation();
      e.preventDefault();
      inputRef.current?.blur();
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
      <div
        className={`group border h-10 rounded flex box-border items-center ${
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
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          id={id}
          name={name}
          type={type}
          disabled={disabled}
          ref={inputRef}
          onBlur={validate}
          autoComplete="off"
          spellCheck="false"
          className={`bg-transparent border-none focus:outline-none w-full group-focus-within:placeholder:text-gray-100 disabled:placeholder:text-gray-500 ${
            type === 'email' ? 'px-1' : 'pl-2.5'
          } transition-all duration-300 ease-in-bounce outline-none outline-0 pr-9`}
          onKeyDown={handleEnter}
          onCompositionStart={startComposition}
          onCompositionEnd={endComposition}
        />
        {value ? (
          <ClearButton
            tabIndex={-1}
            onClick={() => {
              onChange({
                target: { value: '', name },
              } as ChangeEvent<HTMLInputElement>);
              inputRef.current?.focus();
            }}
            className={success ? 'group-focus-within:flex hidden' : 'flex'}
          />
        ) : null}
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

export default SearchTextInput;
