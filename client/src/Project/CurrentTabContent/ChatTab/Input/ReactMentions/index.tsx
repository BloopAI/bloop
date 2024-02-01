import React, {
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Mention,
  MentionsInput,
  OnChangeHandlerFunc,
  SuggestionDataItem,
} from 'react-mentions';
import { Trans, useTranslation } from 'react-i18next';
import { getFileExtensionForLang, splitPath } from '../../../../../utils';
import FileIcon from '../../../../../components/FileIcon';
import { FolderIcon, RepositoryIcon } from '../../../../../icons';
import { ParsedQueryType } from '../../../../../types/general';
import { blurInput } from '../../../../../utils/domUtils';
import { MentionOptionType } from '../../../../../types/results';

type Props = {
  placeholder: string;
  getDataLang: (s: string) => Promise<MentionOptionType[]>;
  getDataPath: (s: string) => Promise<MentionOptionType[]>;
  getDataRepo: (s: string) => Promise<MentionOptionType[]>;
  value?: { parsed: ParsedQueryType[]; plain: string };
  onChange: (v: string) => void;
  onSubmit: (v: { parsed: ParsedQueryType[]; plain: string }) => void;
  isDisabled?: boolean;
};

const inputStyle = {
  '&multiLine': {
    highlighter: {
      maxHeight: 300,
      overflow: 'auto',
    },
    input: {
      maxHeight: 300,
      overflow: 'auto',
      outline: 'none',
    },
  },
  suggestions: {
    list: {
      maxHeight: '40vh',
      overflowY: 'auto',
      backgroundColor: 'rgb(var(--bg-shade))',
      border: '1px solid rgb(var(--bg-border))',
      boxShadow: 'var(--shadow-high)',
      padding: 4,
      zIndex: 100,
      borderRadius: 6,
      marginTop: 6,
    },
  },
};

const ReactMentionsInput = ({
  placeholder,
  onSubmit,
  onChange,
  getDataPath,
  getDataRepo,
  getDataLang,
  value,
  isDisabled,
}: Props) => {
  const { t } = useTranslation();
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
      if (e.key === 'Enter' && !e.shiftKey && onSubmit && value) {
        e.preventDefault();
        blurInput();
        onSubmit({
          plain: value.plain
            .replace(/\|(repo:.*?)\|/, '$1')
            .replace(/\|(path:.*?)\|/, '$1')
            .replace(/\|(lang:.*?)\|/, '$1'),
          parsed: value.parsed,
        });
      }
    },
    [isComposing, onSubmit, value],
  );

  const repoTransform = useCallback((id: string, trans: string) => {
    const split = splitPath(trans);
    return trans.startsWith('local//')
      ? split.slice(-1)[0]
      : split.slice(-2).join('/');
  }, []);

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

  const handleChange = useCallback<OnChangeHandlerFunc>(
    (e) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const renderRepoSuggestion = useCallback(
    (
      entry: SuggestionDataItem,
      search: string,
      highlightedDisplay: ReactNode,
      index: number,
      focused: boolean,
    ) => {
      const d = entry as MentionOptionType;
      return (
        <div>
          {d.isFirst ? (
            <div className="flex items-center rounded-6 gap-2 px-2 py-1 text-label-muted caption cursor-default">
              <Trans>Repositories</Trans>
            </div>
          ) : null}
          <div
            className={`flex items-center justify-between rounded-6 gap-2 px-2 h-8 ${
              focused ? 'bg-bg-base-hover' : ''
            } body-s text-label-title cursor-pointer max-w-[600px] ellipsis`}
          >
            <span className="flex items-center gap-2">
              <RepositoryIcon sizeClassName="w-4 h-4" />
              <span className="ellipsis text-left ">{d.display}</span>
            </span>
            <span className="ellipsis text-label-muted text-left body-mini">
              {d.hint}
            </span>
          </div>
        </div>
      );
    },
    [],
  );

  const renderPathSuggestion = useCallback(
    (
      entry: SuggestionDataItem,
      search: string,
      highlightedDisplay: ReactNode,
      index: number,
      focused: boolean,
    ) => {
      const d = entry as MentionOptionType;
      return (
        <div>
          {d.isFirst ? (
            <div className="flex items-center rounded-6 gap-2 px-2 py-1 text-label-muted caption cursor-default">
              <Trans>{d.type === 'dir' ? 'Directories' : 'Files'}</Trans>
            </div>
          ) : null}
          <div
            className={`flex items-center justify-between rounded-6 gap-2 px-2 h-8 ${
              focused ? 'bg-bg-base-hover' : ''
            } body-s text-label-title cursor-pointer max-w-[600px] ellipsis`}
          >
            <span className="flex items-center gap-2">
              {d.type === 'dir' ? (
                <FolderIcon sizeClassName="w-4 h-4" />
              ) : (
                <FileIcon filename={d.display} />
              )}
              <span className="ellipsis text-left ">{d.display}</span>
            </span>
            <span className="ellipsis text-label-muted text-left body-mini">
              {d.hint}
            </span>
          </div>
        </div>
      );
    },
    [],
  );

  const renderLangSuggestion = useCallback(
    (
      entry: SuggestionDataItem,
      search: string,
      highlightedDisplay: ReactNode,
      index: number,
      focused: boolean,
    ) => {
      const d = entry as MentionOptionType;
      return (
        <div>
          {d.isFirst ? (
            <div className="flex items-center rounded-6 gap-2 px-2 py-1 text-label-muted caption cursor-default">
              <Trans>Languages</Trans>
            </div>
          ) : null}
          <div
            className={`flex items-center justify-between rounded-6 gap-2 px-2 h-8 ${
              focused ? 'bg-bg-base-hover' : ''
            } body-s text-label-title cursor-pointer max-w-[600px] ellipsis`}
          >
            <span className="flex items-center gap-2">
              <FileIcon filename={getFileExtensionForLang(d.display, true)} />
              <span className="ellipsis text-left ">{d.display}</span>
            </span>
            <span className="ellipsis text-label-muted text-left body-mini">
              {d.hint}
            </span>
          </div>
        </div>
      );
    },
    [],
  );

  return (
    <div className="w-full body-base pb-4 !leading-[24px] bg-transparent outline-none focus:outline-0 resize-none flex-grow-0 flex flex-col justify-center">
      <MentionsInput
        value={value?.plain || ''}
        // id={id}
        onChange={handleChange}
        className={`ReactMention w-full bg-transparent rounded-lg outline-none focus:outline-0 resize-none
        placeholder:text-current flex-grow-0`}
        placeholder={placeholder}
        inputRef={inputRef}
        disabled={isDisabled}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        // @ts-ignore
        onKeyDown={handleKeyDown}
        // onFocus={handleInputFocus}
        style={inputStyle}
      >
        <Mention
          trigger="@"
          markup="|repo:__id__|"
          data={getDataRepo}
          renderSuggestion={renderRepoSuggestion}
          className="relative before:bg-bg-shade-hover before:rounded before:absolute before:-top-0.5 before:-bottom-0.5 before:-left-1 before:-right-0.5"
          appendSpaceOnAdd
          displayTransform={repoTransform}
        />
        <Mention
          trigger="@"
          markup="|path:__id__|"
          data={getDataPath}
          renderSuggestion={renderPathSuggestion}
          className="relative before:bg-bg-shade-hover before:rounded before:absolute before:-top-0.5 before:-bottom-0.5 before:-left-1 before:-right-0.5"
          appendSpaceOnAdd
          displayTransform={pathTransform}
        />
        <Mention
          trigger="@"
          markup="|lang:__id__|"
          data={getDataLang}
          appendSpaceOnAdd
          renderSuggestion={renderLangSuggestion}
          className="relative before:bg-bg-shade-hover before:rounded before:absolute before:-top-0.5 before:-bottom-0.5 before:-left-1 before:-right-0.5"
        />
      </MentionsInput>
    </div>
  );
};

export default memo(ReactMentionsInput);
