import React, {
  ChangeEvent,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { StudioConversationMessageAuthor } from '../../../../../types/general';
import MarkdownWithCode from '../../../../../components/MarkdownWithCode';
import {
  PencilIcon,
  PersonIcon,
  RefreshIcon,
  TemplatesIcon,
  TrashCanIcon,
  WarningSignIcon,
} from '../../../../../icons';
import Button from '../../../../../components/Button';
import CopyButton from '../../../../../components/MarkdownWithCode/CopyButton';
import { StudioTemplateType } from '../../../../../types/api';
import Dropdown from '../../../../../components/Dropdown';
import { useTemplateShortcut } from '../../../../../consts/shortcuts';
import SpinLoaderContainer from '../../../../../components/Loaders/SpinnerLoader';
import TemplatesDropdown from './TemplatesDropdown';

type Props = {
  author: StudioConversationMessageAuthor;
  message: string;
  isLoading?: boolean;
  onMessageChange: (m: string, i?: number) => void;
  onMessageRemoved?: (i: number, andSubsequent?: boolean) => void;
  i?: number;
  inputRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  templatesRef?: React.MutableRefObject<HTMLButtonElement | null>;
  isTokenLimitExceeded: boolean;
  isLast: boolean;
  isActiveTab: boolean;
  side: 'left' | 'right';
  templates?: StudioTemplateType[];
  setIsDropdownShown: (b: boolean) => void;
};

const ConversationInput = ({
  author,
  message,
  onMessageChange,
  i,
  onMessageRemoved,
  inputRef,
  isLast,
  isTokenLimitExceeded,
  side,
  templates,
  setIsDropdownShown,
  templatesRef,
  isActiveTab,
  isLoading,
}: Props) => {
  const { t } = useTranslation();
  const [isFocused, setFocused] = useState(i === undefined);
  const [value, setValue] = useState(message);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const cloneRef = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(inputRef, () => ref.current!);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      if (isActiveTab) {
        if (i === undefined) {
          onMessageChange(e.target.value, i);
        }
        setValue(e.target.value);
      }
    },
    [i, onMessageChange, isActiveTab],
  );

  useEffect(() => {
    if (isFocused) {
      setValue(message);
    }
  }, [isFocused, message]);

  useEffect(() => {
    if (i === undefined) {
      setFocused(true);
    }
  }, [i, message]);

  const handleBlur = useCallback(() => {
    setTimeout(() => setFocused(false), 100); // to allow press on top buttons
    if (i !== undefined) {
      onMessageChange(value, i);
    }
  }, [onMessageChange, value, i]);

  useEffect(() => {
    if (!isActiveTab) {
      inputRef?.current?.blur();
    } else {
      inputRef?.current?.focus();
    }
  }, [isActiveTab]);

  useEffect(() => {
    if (ref.current && cloneRef.current) {
      cloneRef.current.style.height = '19px';
      const scrollHeight = cloneRef.current.scrollHeight;

      // We then set the height directly, outside of the render loop
      // Trying to set this with state or a ref will product an incorrect value.
      ref.current.style.height =
        Math.min(Math.max(scrollHeight, 19), 300) + 'px';
    }
  }, [message, isFocused, value]);

  const dropdownProps = useMemo(() => {
    return {
      templates,
      onTemplateSelected: onMessageChange,
    };
  }, [templates, onMessageChange, i]);

  return (
    <div className="flex items-start w-full p-4 gap-4 rounded-md hover:bg-bg-sub-hover relative group">
      {author === StudioConversationMessageAuthor.USER ? (
        <div className="w-7 h-7 rounded-full overflow-hidden select-none flex-shrink-0">
          <PersonIcon sizeClassName="w-6 h-6" />
        </div>
      ) : (
        <div className="flex w-7 h-7 items-center justify-center rounded-full bg-brand-studio-subtle flex-shrink-0">
          {isLoading ? (
            <SpinLoaderContainer
              sizeClassName="w-5 h-5"
              colorClassName="text-brand-studio"
            />
          ) : (
            <img className="bloop-head-img w-7 h-7" alt="bloop" />
          )}
        </div>
      )}
      <div className="flex flex-col gap-1 flex-1 items-start overflow-auto">
        <div className="w-full flex items-center justify-between gap-1">
          <p className="body-base-b text-label-title select-none">
            {author === StudioConversationMessageAuthor.USER ? (
              <Trans>You</Trans>
            ) : (
              'bloop'
            )}
          </p>
          {i === undefined && (
            <Dropdown
              DropdownComponent={TemplatesDropdown}
              dropdownComponentProps={dropdownProps}
              dropdownPlacement="bottom-end"
              appendTo={document.body}
              size="auto"
              onVisibilityChange={setIsDropdownShown}
            >
              <Button
                variant="tertiary"
                size="small"
                title={t('Use template')}
                shortcut={useTemplateShortcut}
                ref={templatesRef}
              >
                <TemplatesIcon sizeClassName="w-4 h-4" />
                <Trans>Templates</Trans>
              </Button>
            </Dropdown>
          )}
        </div>
        <div
          className={`w-full code-studio-md break-words body-base relative ${
            isFocused || i === undefined ? 'flex flex-col' : ''
          }`}
        >
          {isFocused || i === undefined ? (
            <>
              <textarea
                className={`w-full bg-transparent outline-none focus:outline-0 resize-none body-base placeholder:text-label-muted`}
                placeholder={t('Start typing...')}
                value={value}
                onChange={handleChange}
                autoComplete="off"
                spellCheck="false"
                ref={ref}
                rows={1}
                onBlur={handleBlur}
                autoFocus
              />
              <textarea
                className={`resize-none body-base absolute top-0 left-0 right-0 -z-10 opacity-0`}
                value={value}
                disabled
                rows={1}
                ref={cloneRef}
              />
            </>
          ) : (
            <>
              <MarkdownWithCode markdown={message} isCodeStudio side={side} />
              {author === StudioConversationMessageAuthor.ASSISTANT &&
                isLast &&
                isTokenLimitExceeded && (
                  <div
                    className={
                      'flex p-2 gap-2 items-start rounded bg-red-subtle text-red body-mini'
                    }
                  >
                    <WarningSignIcon sizeClassName="w-5 h-5" />
                    <Trans>
                      Token limit reached, this answer may be incomplete. To
                      generate a full answer, please reduce the number of tokens
                      used and regenerate.
                    </Trans>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
      {i !== undefined && (
        <div className="opacity-0 group-hover:opacity-100 absolute -top-4 right-4 flex items-center p-1 gap-1 rounded-6 border border-bg-border bg-bg-base shadow-medium">
          {author === StudioConversationMessageAuthor.ASSISTANT && (
            <CopyButton code={message} isInHeader btnVariant="tertiary" />
          )}
          <Button
            size="mini"
            variant="tertiary"
            onlyIcon
            title={t('Edit')}
            onClick={() => setFocused(true)}
          >
            <PencilIcon sizeClassName="w-3.5 h-3.5" />
          </Button>
          {author === StudioConversationMessageAuthor.USER && (
            <Button
              size="mini"
              variant="tertiary"
              onlyIcon
              title={t('Retry')}
              onClick={() => onMessageRemoved?.(i, true)}
            >
              <RefreshIcon sizeClassName="w-3.5 h-3.5" />
            </Button>
          )}
          <div className="w-px h-3 bg-bg-border flex-shrink-0" />
          <Button
            size="mini"
            variant="tertiary"
            onlyIcon
            title={t('Remove')}
            onClick={() => onMessageRemoved?.(i)}
          >
            <TrashCanIcon sizeClassName="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default memo(ConversationInput);
