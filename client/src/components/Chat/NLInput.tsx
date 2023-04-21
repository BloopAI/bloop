import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { QuillIcon, SendIcon } from '../../icons';
import ClearButton from '../ClearButton';
import Tooltip from '../Tooltip';

type Props = {
  id?: string;
  value?: string;
  placeholder?: string;
  isStoppable?: boolean;
  onStop?: () => void;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit?: () => void;
};

const NLInput = ({
  id,
  value,
  onChange,
  placeholder = 'Anything I can help you with?',
  isStoppable,
  onStop,
  onSubmit,
}: Props) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setComposition] = useState(false);

  useEffect(() => {
    if (inputRef.current) {
      // We need to reset the height momentarily to get the correct scrollHeight for the textarea
      inputRef.current.style.height = '56px';
      const scrollHeight = inputRef.current.scrollHeight;

      // We then set the height directly, outside of the render loop
      // Trying to set this with state or a ref will product an incorrect value.
      inputRef.current.style.height = Math.min(scrollHeight, 300) + 'px';
    }
  }, [inputRef.current, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isComposing) {
        return true;
      }
      if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    },
    [isComposing, onSubmit],
  );

  return (
    <div
      className={`w-full flex items-start gap-2 bg-gray-800 rounded-lg disabled:border-transparent disabled:text-gray-500
    border border-gray-700 focus-within:border-gray-600 hover:border-gray-600 px-4
    text-gray-400 focus-within:text-gray-100 hover:text-gray-100 transition-all ease-out duration-150 flex-grow-0`}
    >
      <span className="py-4">
        <QuillIcon />
      </span>
      <textarea
        className={`w-full py-4 bg-transparent rounded-lg outline-none focus:outline-0 resize-none
        placeholder:text-current flex-grow-0`}
        placeholder={placeholder}
        id={id}
        value={value}
        onChange={onChange}
        rows={1}
        autoComplete="off"
        spellCheck="false"
        ref={inputRef}
        disabled={isStoppable}
        onCompositionStart={() => setComposition(true)}
        onCompositionEnd={() => setComposition(false)}
        onKeyDown={handleKeyDown}
      />
      {isStoppable ? (
        <div className="relative top-[18px]">
          <Tooltip text={'Stop generating'} placement={'top-end'}>
            <ClearButton onClick={onStop} />
          </Tooltip>
        </div>
      ) : value ? (
        <button type="submit" className="self-end py-3 text-primary-300">
          <Tooltip text={'Submit'} placement={'top-end'}>
            <SendIcon />
          </Tooltip>
        </button>
      ) : (
        ''
      )}
    </div>
  );
};

export default NLInput;
