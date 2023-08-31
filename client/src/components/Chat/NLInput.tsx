import React, {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { FeatherSelected, QuillIcon, SendIcon, Sparkles } from '../../icons';
import ClearButton from '../ClearButton';
import Tooltip from '../Tooltip';
import { ChatLoadingStep } from '../../types/general';
import LiteLoader from '../Loaders/LiteLoader';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import Button from '../Button';
import InputLoader from './InputLoader';

type Props = {
  id?: string;
  value?: string;
  generationInProgress?: boolean;
  isStoppable?: boolean;
  showTooltip?: boolean;
  tooltipText?: string;
  onStop?: () => void;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit?: () => void;
  loadingSteps?: ChatLoadingStep[];
  selectedLines?: [number, number] | null;
  setSelectedLines?: (l: [number, number] | null) => void;
  queryIdToEdit?: string;
  onMessageEditCancel?: () => void;
};

const defaultPlaceholder = 'Anything I can help you with?';

const NLInput = ({
  id,
  value,
  onChange,
  generationInProgress,
  isStoppable,
  onStop,
  onSubmit,
  loadingSteps,
  selectedLines,
  setSelectedLines,
  queryIdToEdit,
  onMessageEditCancel,
}: Props) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setComposition] = useState(false);
  const { setPromptGuideOpen } = useContext(UIContext.PromptGuide);
  const { envConfig } = useContext(DeviceContext);

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
    () => isStoppable && !!loadingSteps?.length && generationInProgress,
    [isStoppable, loadingSteps?.length, generationInProgress],
  );

  const handleInputFocus = useCallback(() => {
    if (envConfig?.bloop_user_profile?.prompt_guide !== 'dismissed') {
      setPromptGuideOpen(true);
    }
  }, [envConfig?.bloop_user_profile?.prompt_guide]);

  return (
    <div
      className={`w-full rounded-lg border border-chat-bg-border focus-within:border-chat-bg-border-hover px-4 ${
        isStoppable && loadingSteps?.length
          ? 'bg-transparent'
          : 'bg-chat-bg-base hover:text-label-title hover:border-chat-bg-border-hover'
      } transition-all ease-out duration-150 flex-grow-0 relative`}
    >
      <div
        className={`w-full flex items-start gap-2 
    text-label-base focus-within:text-label-title`}
      >
        {shouldShowLoader && <InputLoader loadingSteps={loadingSteps!} />}
        <div className="pt-4.5">
          {isStoppable ? (
            <div className="text-bg-main">
              <LiteLoader />
            </div>
          ) : selectedLines ? (
            <FeatherSelected />
          ) : value ? (
            <QuillIcon />
          ) : (
            <Sparkles />
          )}
        </div>
        <textarea
          className={`w-full py-4 bg-transparent rounded-lg outline-none focus:outline-0 resize-none
        placeholder:text-current placeholder:truncate placeholder:max-w-[19.5rem] flex-grow-0`}
          placeholder={shouldShowLoader ? '' : t(defaultPlaceholder)}
          id={id}
          value={value}
          onChange={onChange}
          rows={1}
          autoComplete="off"
          spellCheck="false"
          ref={inputRef}
          disabled={isStoppable && generationInProgress}
          onCompositionStart={() => setComposition(true)}
          onCompositionEnd={() => {
            // this event comes before keydown and sets state faster causing unintentional submit
            setTimeout(() => setComposition(false), 10);
          }}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
        />
        {isStoppable || selectedLines ? (
          <div className="relative top-[18px]">
            <Tooltip text={t('Stop generating')} placement={'top-end'}>
              <ClearButton
                onClick={() =>
                  isStoppable ? onStop?.() : setSelectedLines?.(null)
                }
              />
            </Tooltip>
          </div>
        ) : value && !queryIdToEdit ? (
          <button type="submit" className="self-end py-3 text-bg-main">
            <Tooltip text={t('Submit')} placement={'top-end'}>
              <SendIcon />
            </Tooltip>
          </button>
        ) : (
          ''
        )}
      </div>
      {!!queryIdToEdit && (
        <div className="flex items-center justify-end gap-2 mb-4">
          <Button variant="tertiary" size="small" onClick={onMessageEditCancel}>
            <Trans>Cancel</Trans>
          </Button>
          <Button size="small" type="submit">
            <Trans>Submit</Trans>
          </Button>
        </div>
      )}
    </div>
  );
};

export default memo(NLInput);
