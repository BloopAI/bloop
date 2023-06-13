import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FeatherSelected,
  MagnifyTool,
  PointClick,
  QuillIcon,
  SendIcon,
} from '../../icons';
import ClearButton from '../ClearButton';
import Tooltip from '../Tooltip';
import { ChatLoadingStep } from '../../types/general';
import InputLoader from './InputLoader';

type Props = {
  id?: string;
  value?: string;
  placeholder?: string;
  isStoppable?: boolean;
  onStop?: () => void;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit?: () => void;
  loadingSteps?: ChatLoadingStep[];
  selectedLines?: [number, number] | null;
  setSelectedLines?: (l: [number, number] | null) => void;
};

const defaultPlaceholder = 'Anything I can help you with?';

const NLInput = ({
  id,
  value,
  onChange,
  placeholder = defaultPlaceholder,
  isStoppable,
  onStop,
  onSubmit,
  loadingSteps,
  selectedLines,
  setSelectedLines,
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
      inputRef.current.style.height =
        Math.max(Math.min(scrollHeight, 300), 56) + 'px';
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

  const shouldShowLoader = useMemo(
    () =>
      isStoppable &&
      !!loadingSteps?.length &&
      placeholder !== defaultPlaceholder,
    [isStoppable, loadingSteps?.length, placeholder],
  );

  return (
    <div
      className={`w-full flex items-start gap-2 rounded-lg 
    border border-chat-bg-border focus-within:border-chat-bg-border-hover px-4
    text-label-base focus-within:text-label-title ${
      isStoppable && loadingSteps?.length
        ? 'bg-transparent'
        : 'bg-chat-bg-base hover:text-label-title hover:border-chat-bg-border-hover'
    } transition-all ease-out duration-150 flex-grow-0 relative`}
    >
      {shouldShowLoader && <InputLoader loadingSteps={loadingSteps!} />}
      <div className="pt-4.5">
        {shouldShowLoader ? (
          loadingSteps?.[loadingSteps?.length - 1]?.type === 'PROC' ? (
            <PointClick />
          ) : (
            <MagnifyTool />
          )
        ) : selectedLines ? (
          <FeatherSelected />
        ) : (
          <QuillIcon />
        )}
      </div>
      <textarea
        className={`w-full py-4 bg-transparent rounded-lg outline-none focus:outline-0 resize-none
        placeholder:text-current placeholder:truncate placeholder:max-w-[19.5rem] flex-grow-0`}
        placeholder={placeholder}
        id={id}
        value={value}
        onChange={onChange}
        rows={1}
        autoComplete="off"
        spellCheck="false"
        ref={inputRef}
        disabled={isStoppable && placeholder !== defaultPlaceholder}
        onCompositionStart={() => setComposition(true)}
        onCompositionEnd={() => setComposition(false)}
        onKeyDown={handleKeyDown}
      />
      {isStoppable || selectedLines ? (
        <div className="relative top-[18px]">
          <Tooltip text={'Stop generating'} placement={'top-end'}>
            <ClearButton
              onClick={() =>
                isStoppable ? onStop?.() : setSelectedLines?.(null)
              }
            />
          </Tooltip>
        </div>
      ) : value ? (
        <button type="submit" className="self-end py-3 text-bg-main">
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
