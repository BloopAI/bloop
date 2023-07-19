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
  regex?: boolean;
  type?: HTMLInputTypeAttribute;
  onSubmit?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onRegexClick?: () => void;
  validate?: () => void;
  regexEnabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
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
    <div className={`flex flex-col gap-1 w-full text-label-title body-s`}>
      <div
        className={`group border h-10 rounded flex box-border items-center bg-bg-base hover:bg-bg-base-hover
         border-bg-border hover:border-bg-border-hover focus-within:border-bg-border-hover 
         transition-all duration-300 ease-in-bounce relative`}
      >
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          id={id}
          name={name}
          type={type}
          ref={inputRef}
          onBlur={validate}
          autoComplete="off"
          spellCheck="false"
          className={`bg-transparent border-none focus:outline-none w-full group-focus-within:placeholder:text-label-title disabled:placeholder:text-label-muted ${
            type === 'email' ? 'px-1' : 'pl-2.5'
          } transition-all duration-300 ease-in-bounce outline-none outline-0`}
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
            className="flex"
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
    </div>
  );
});

export default SearchTextInput;
