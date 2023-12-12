import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { FeatherSelected, QuillIcon, SendIcon, Sparkles } from '../../../icons';
import ClearButton from '../../ClearButton';
import Tooltip from '../../Tooltip';
import { ChatLoadingStep, ParsedQueryType } from '../../../types/general';
import LiteLoader from '../../Loaders/LiteLoader';
import { UIContext } from '../../../context/uiContext';
import { DeviceContext } from '../../../context/deviceContext';
import Button from '../../Button';
import { getAutocomplete } from '../../../services/api';
import { FileResItem, LangItem } from '../../../types/api';
import { InputEditorContent } from '../../../utils';
import InputLoader from './InputLoader';
import InputCore from './Input/InputCore';
import { mapEditorContentToInputValue } from './Input/utils';

type Props = {
  value?: { parsed: ParsedQueryType[]; plain: string };
  valueToEdit?: Record<string, any> | null;
  generationInProgress?: boolean;
  isStoppable?: boolean;
  showTooltip?: boolean;
  tooltipText?: string;
  onStop?: () => void;
  setInputValue: Dispatch<
    SetStateAction<{ parsed: ParsedQueryType[]; plain: string }>
  >;
  onSubmit?: (s: { parsed: ParsedQueryType[]; plain: string }) => void;
  loadingSteps?: ChatLoadingStep[];
  selectedLines?: [number, number] | null;
  setSelectedLines?: (l: [number, number] | null) => void;
  queryIdToEdit?: string;
  onMessageEditCancel?: () => void;
};

type SuggestionType = {
  id: string;
  display: string;
  type: 'file' | 'dir' | 'lang';
  isFirst: boolean;
};

const defaultPlaceholder = 'Send a message';

const NLInput = ({
  value,
  valueToEdit,
  setInputValue,
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
  const { setPromptGuideOpen } = useContext(UIContext.PromptGuide);
  const { tab } = useContext(UIContext.Tab);
  const { envConfig } = useContext(DeviceContext);

  const shouldShowLoader = useMemo(
    () => isStoppable && !!loadingSteps?.length && generationInProgress,
    [isStoppable, loadingSteps?.length, generationInProgress],
  );

  const handleInputFocus = useCallback(() => {
    if (envConfig?.bloop_user_profile?.prompt_guide !== 'dismissed') {
      setPromptGuideOpen(true);
    }
  }, [envConfig?.bloop_user_profile?.prompt_guide]);

  const getDataPath = useCallback(
    async (search: string) => {
      const respPath = await getAutocomplete(
        `path:${search} repo:${tab.name}&content=false`,
      );
      const fileResults = respPath.data.filter(
        (d): d is FileResItem => d.kind === 'file_result',
      );
      const dirResults = fileResults
        .filter((d) => d.data.is_dir)
        .map((d) => d.data.relative_path.text);
      const filesResults = fileResults
        .filter((d) => !d.data.is_dir)
        .map((d) => d.data.relative_path.text);
      const results: SuggestionType[] = [];
      filesResults.forEach((fr, i) => {
        results.push({ id: fr, display: fr, type: 'file', isFirst: i === 0 });
      });
      dirResults.forEach((fr, i) => {
        results.push({ id: fr, display: fr, type: 'dir', isFirst: i === 0 });
      });
      return results;
    },
    [tab.repoName],
  );

  const getDataLang = useCallback(
    async (
      search: string,
      // callback: (a: { id: string; display: string }[]) => void,
    ) => {
      const respLang = await getAutocomplete(
        `lang:${search} repo:${tab.name}&content=false`,
      );
      const langResults = respLang.data
        .filter((d): d is LangItem => d.kind === 'lang')
        .map((d) => d.data);
      const results: SuggestionType[] = [];
      langResults.forEach((fr, i) => {
        results.push({ id: fr, display: fr, type: 'lang', isFirst: i === 0 });
      });
      return results;
    },
    [tab.name],
  );

  const onChangeInput = useCallback((inputState: InputEditorContent[]) => {
    setInputValue(mapEditorContentToInputValue(inputState));
  }, []);

  const onSubmitButtonClicked = useCallback(() => {
    if (value && onSubmit) {
      onSubmit(value);
    }
  }, [value, onSubmit]);

  return (
    <div
      className={`w-full rounded-lg border border-chat-bg-border focus-within:border-chat-bg-border-hover px-4 ${
        isStoppable && loadingSteps?.length
          ? 'bg-transparent'
          : 'bg-chat-bg-base hover:text-label-title hover:border-chat-bg-border-hover'
      } transition-all ease-out duration-150 flex-grow-0 relative z-100`}
      onClick={handleInputFocus}
    >
      <div
        className={`w-full flex items-start gap-2 text-label-base focus-within:text-label-title`}
      >
        {shouldShowLoader && <InputLoader loadingSteps={loadingSteps!} />}
        <div className="pt-4.5">
          {isStoppable ? (
            <div className="text-bg-main">
              <LiteLoader />
            </div>
          ) : selectedLines ? (
            <FeatherSelected />
          ) : value?.plain ? (
            <QuillIcon />
          ) : (
            <Sparkles />
          )}
        </div>
        {!isStoppable && !generationInProgress ? (
          <InputCore
            getDataLang={getDataLang}
            getDataPath={getDataPath}
            initialValue={valueToEdit}
            onChange={onChangeInput}
            onSubmit={onSubmit}
            placeholder={t(defaultPlaceholder)}
          />
        ) : (
          <div className="w-full h-14 flex-1 flex items-center">
            {!shouldShowLoader && <Trans>Generating answer...</Trans>}
          </div>
        )}
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
        ) : value?.plain && !queryIdToEdit ? (
          <button
            type="button"
            className="self-end py-3 text-bg-main"
            onClick={onSubmitButtonClicked}
          >
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
