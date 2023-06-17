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
  Sparkle,
} from '../../icons';
import ClearButton from '../ClearButton';
import Tooltip from '../Tooltip';
import { ChatLoadingStep } from '../../types/general';
import InputLoader from './InputLoader';
import StarsSvg from './StarsSvg';

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
        ) : value ? (
          <QuillIcon />
        ) : (
          <div
            className={`relative w-6 h-6 -mt-0.5 rounded-full flex items-center justify-center 
             border border-chat-bg-border bg-chat-bg-base`}
          >
            {/*{showTooltip && (*/}
            {/*  <div className="absolute -top-11 z-10 -right-4.5 drop-shadow-sm select-none">*/}
            {/*    <div className="bg-chat-bg-base border border-chat-bg-border rounded-4 flex py-2 px-4 w-max body-s text-label-title">*/}
            {/*      {tooltipText}*/}
            {/*    </div>*/}
            {/*    <span className="absolute right-[39px] bottom-0 w-3.5 h-px bg-chat-bg-base z-10" />*/}
            {/*    <svg*/}
            {/*      width="97"*/}
            {/*      height="14"*/}
            {/*      viewBox="0 0 97 14"*/}
            {/*      fill="none"*/}
            {/*      xmlns="http://www.w3.org/2000/svg"*/}
            {/*      className="absolute -bottom-2 right-0 -z-10"*/}
            {/*    >*/}
            {/*      <path*/}
            {/*        d="M31.5 4V4.5H32C37.1106 4.5 41.1041 5.2109 44.6844 6.65285C48.2676 8.09598 51.4662 10.283 54.9751 13.2761C55.5683 13.7821 56.438 13.2356 56.2997 12.5031C55.9833 10.8263 55.9276 9.09472 56.9816 7.66601C58.0394 6.2322 60.3211 4.96159 65.0488 4.49761L65.5 4.45333V4V1V0.5H65H32H31.5V1V4Z"*/}
            {/*        className="fill-chat-bg-base stroke-chat-bg-border"*/}
            {/*      />*/}
            {/*    </svg>*/}
            {/*  </div>*/}
            {/*)}*/}
            <div className="absolute rounded-full top-0 left-0 right-0 bottom-0 flex z-0 overflow-hidden">
              <StarsSvg />
              <div className="absolute rounded-full top-0 left-0 right-0 bottom-0 z-10 chat-head-bg animate-spin-extra-slow" />
            </div>
            <div className={`w-2 h-2 relative z-10 text-label-title`}>
              <Sparkle raw />
            </div>
          </div>
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
