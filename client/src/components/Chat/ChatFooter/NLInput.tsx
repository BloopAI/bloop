import React, {
  memo,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  MentionsInput,
  Mention,
  OnChangeHandlerFunc,
  SuggestionDataItem,
} from 'react-mentions';
import {
  FeatherSelected,
  FolderFilled,
  QuillIcon,
  SendIcon,
  Sparkles,
} from '../../../icons';
import ClearButton from '../../ClearButton';
import Tooltip from '../../Tooltip';
import { ChatLoadingStep } from '../../../types/general';
import LiteLoader from '../../Loaders/LiteLoader';
import { UIContext } from '../../../context/uiContext';
import { DeviceContext } from '../../../context/deviceContext';
import Button from '../../Button';
import { getAutocomplete } from '../../../services/api';
import { FileResItem, LangItem } from '../../../types/api';
import FileIcon from '../../FileIcon';
import { getFileExtensionForLang, splitPath } from '../../../utils';
import InputLoader from './InputLoader';

type Props = {
  id?: string;
  value?: string;
  generationInProgress?: boolean;
  isStoppable?: boolean;
  showTooltip?: boolean;
  tooltipText?: string;
  onStop?: () => void;
  onChange?: OnChangeHandlerFunc;
  onSubmit?: () => void;
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

const inputStyle = {
  '&multiLine': {
    highlighter: {
      paddingTop: 16,
      paddingBottom: 16,
    },
    input: {
      paddingTop: 16,
      paddingBottom: 16,
      outline: 'none',
    },
  },
  suggestions: {
    list: {
      maxHeight: 500,
      overflowY: 'auto',
      backgroundColor: 'rgb(var(--chat-bg-shade))',
      border: '1px solid rgb(var(--chat-bg-border))',
      boxShadow: 'var(--shadow-high)',
      padding: 4,
      zIndex: 100,
    },
  },
};

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
  const { tab } = useContext(UIContext.Tab);
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

  const getDataPath = useCallback(
    async (
      search: string,
      callback: (a: { id: string; display: string }[]) => void,
    ) => {
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
      callback(results);
    },
    [tab.repoName],
  );

  const getDataLang = useCallback(
    async (
      search: string,
      callback: (a: { id: string; display: string }[]) => void,
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
      callback(results);
    },
    [tab.name],
  );

  const renderPathSuggestion = useCallback(
    (
      entry: SuggestionDataItem,
      search: string,
      highlightedDisplay: ReactNode,
      index: number,
      focused: boolean,
    ) => {
      const d = entry as SuggestionType;
      return (
        <div>
          {d.isFirst ? (
            <div className="flex items-center rounded-6 gap-2 px-2 py-1 text-label-muted caption cursor-default">
              <Trans>{d.type === 'dir' ? 'Directories' : 'Files'}</Trans>
            </div>
          ) : null}
          <div
            className={`flex items-center justify-start rounded-6 gap-2 px-2 py-1 ${
              focused ? 'bg-chat-bg-base-hover' : ''
            } body-s text-label-title`}
          >
            {d.type === 'dir' ? (
              <FolderFilled />
            ) : (
              <FileIcon filename={d.display} />
            )}
            {d.display}
          </div>
        </div>
      );
    },
    [],
  );

  const pathTransform = useCallback((id: string, trans: string) => {
    const split = splitPath(trans);
    return `${split[split.length - 1] || split[split.length - 2]}`;
  }, []);

  const onCompositionStart = useCallback(() => {
    setComposition(true);
  }, []);

  const onCompositionEnd = useCallback(() => {
    // this event comes before keydown and sets state faster causing unintentional submit
    setTimeout(() => setComposition(false), 10);
  }, []);

  const renderLangSuggestion = useCallback(
    (
      entry: SuggestionDataItem,
      search: string,
      highlightedDisplay: ReactNode,
      index: number,
      focused: boolean,
    ) => {
      const d = entry as SuggestionType;
      return (
        <div>
          {d.isFirst ? (
            <div className="flex items-center rounded-6 gap-2 px-2 py-1 text-label-muted caption cursor-default">
              <Trans>Languages</Trans>
            </div>
          ) : null}
          <div
            className={`flex items-center justify-start rounded-6 gap-2 px-2 py-1 ${
              focused ? 'bg-chat-bg-base-hover' : ''
            } body-s text-label-title`}
          >
            <FileIcon filename={getFileExtensionForLang(d.display, true)} />
            {d.display}
          </div>
        </div>
      );
    },
    [],
  );

  return (
    <div
      className={`w-full rounded-lg border border-chat-bg-border focus-within:border-chat-bg-border-hover px-4 ${
        isStoppable && loadingSteps?.length
          ? 'bg-transparent'
          : 'bg-chat-bg-base hover:text-label-title hover:border-chat-bg-border-hover'
      } transition-all ease-out duration-150 flex-grow-0 relative z-100`}
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
        <MentionsInput
          value={value}
          id={id}
          onChange={onChange}
          className={`w-full bg-transparent rounded-lg outline-none focus:outline-0 resize-none
        placeholder:text-current placeholder:truncate placeholder:max-w-[19.5rem] flex-grow-0`}
          placeholder={shouldShowLoader ? '' : t(defaultPlaceholder)}
          inputRef={inputRef}
          disabled={isStoppable && generationInProgress}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          // @ts-ignore
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          style={inputStyle}
          forceSuggestionsAboveCursor
        >
          <Mention
            trigger="@"
            markup="|path:__id__|"
            data={getDataPath}
            renderSuggestion={renderPathSuggestion}
            className="relative before:bg-chat-bg-shade before:border before:border-chat-bg-border before:rounded before:absolute before:-top-0.5 before:-bottom-0.5 before:-left-1 before:-right-0.5"
            appendSpaceOnAdd
            displayTransform={pathTransform}
          />
          <Mention
            trigger="@"
            markup="|lang:__id__|"
            data={getDataLang}
            appendSpaceOnAdd
            renderSuggestion={renderLangSuggestion}
            className="relative before:bg-chat-bg-shade before:border before:border-chat-bg-border before:rounded before:absolute before:-top-0.5 before:-bottom-0.5 before:-left-1 before:-right-0.5"
          />
        </MentionsInput>
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
