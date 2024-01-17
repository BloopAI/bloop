import React, {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { StudioConversationMessageAuthor } from '../../../../types/general';
import MarkdownWithCode from '../../../../components/MarkdownWithCode';
import { EnvContext } from '../../../../context/envContext';
import KeyboardHint from '../../../../components/KeyboardHint';
import {
  PencilIcon,
  RefreshIcon,
  TemplatesIcon,
  TrashCanIcon,
  WarningSignIcon,
} from '../../../../icons';
import Button from '../../../../components/Button';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import { checkEventKeys } from '../../../../utils/keyboardUtils';
import { UIContext } from '../../../../context/uiContext';
import CopyButton from '../../../../components/MarkdownWithCode/CopyButton';
import { StudioTemplateType } from '../../../../types/api';
import Dropdown from '../../../../components/Dropdown';
import { useTemplateShortcut } from '../../../../consts/shortcuts';
import TemplatesDropdown from './TemplatesDropdown';

type Props = {
  author: StudioConversationMessageAuthor;
  message: string;
  onMessageChange: (m: string, i?: number) => void;
  onMessageRemoved?: (i: number, andSubsequent?: boolean) => void;
  i?: number;
  inputRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  isTokenLimitExceeded: boolean;
  isLast: boolean;
  side: 'left' | 'right';
  onSubmit?: () => void;
  isActiveTab: boolean;
  isLoading: boolean;
  requestsLeft: number;
  handleCancel: () => void;
  templates?: StudioTemplateType[];
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
  onSubmit,
  isActiveTab,
  requestsLeft,
  isLoading,
  handleCancel,
  templates,
}: Props) => {
  const { t } = useTranslation();
  const { envConfig } = useContext(EnvContext);
  const { setIsUpgradeRequiredPopupOpen } = useContext(
    UIContext.UpgradeRequiredPopup,
  );
  // const { refetchTemplates, setTemplates } = useContext(StudioContext.Setters);
  const [isFocused, setFocused] = useState(false);
  const [isDropdownShown, setIsDropdownShown] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const cloneRef = useRef<HTMLTextAreaElement | null>(null);
  const templatesRef = useRef<HTMLButtonElement | null>(null);
  const [isSaved, setSaved] = useState(false);
  useImperativeHandle(inputRef, () => ref.current!);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onMessageChange(e.target.value, i);
      setSaved(false);
    },
    [i, onMessageChange],
  );

  useEffect(() => {
    if (ref.current && cloneRef.current) {
      cloneRef.current.style.height = '19px';
      const scrollHeight = cloneRef.current.scrollHeight;

      // We then set the height directly, outside of the render loop
      // Trying to set this with state or a ref will product an incorrect value.
      ref.current.style.height =
        Math.min(Math.max(scrollHeight, 19), 300) + 'px';
    }
  }, [message, isFocused]);

  const saveAsTemplate = useCallback(() => {
    setSaved(true);
    // setTemplates((prev) => [
    //   {
    //     name: '',
    //     content: message,
    //     id: 'new',
    //     modified_at: '',
    //     is_default: false,
    //   },
    //   ...prev,
    // ]);
    // setLeftPanel({ type: StudioLeftPanelType.TEMPLATES });
  }, [message]);

  const useTemplates = useCallback(() => {
    // setLeftPanel({ type: StudioLeftPanelType.TEMPLATES });
  }, []);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, ['entr'])) {
        e.preventDefault();
        e.stopPropagation();
        if (
          message &&
          !isTokenLimitExceeded &&
          // !hasContextError &&
          requestsLeft
          // && !isChangeUnsaved
        ) {
          onSubmit?.();
        } else if (!requestsLeft) {
          setIsUpgradeRequiredPopupOpen(true);
        }
        // } else if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        //   setLeftPanel({ type: StudioLeftPanelType.TEMPLATES });
      }
      if (checkEventKeys(e, ['Esc']) && isLoading) {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      }
      if (checkEventKeys(e, useTemplateShortcut) && i === undefined) {
        templatesRef.current?.parentElement?.click();
      }
    },
    [onSubmit, isLoading, requestsLeft, i],
  );
  useKeyboardNavigation(
    handleKeyEvent,
    !isActiveTab || !onSubmit || isDropdownShown,
  );

  const dropdownProps = useMemo(() => {
    return {
      templates,
      onTemplateSelected: (t: string) => {
        onMessageChange(t, i);
        setSaved(false);
      },
    };
  }, [templates, onMessageChange, i]);

  return (
    <div className="flex items-start w-full p-4 gap-4 rounded-md hover:bg-bg-sub-hover relative group">
      {author === StudioConversationMessageAuthor.USER ? (
        <div className="w-7 h-7 rounded-full overflow-hidden select-none flex-shrink-0">
          <img src={envConfig.github_user?.avatar_url} alt={t('avatar')} />
        </div>
      ) : (
        <div className="flex w-7 h-7 items-center justify-center rounded-full bg-brand-studio-subtle flex-shrink-0">
          <img className="bloop-head-img w-7 h-7" alt="bloop" />
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
                value={message}
                onChange={handleChange}
                autoComplete="off"
                spellCheck="false"
                ref={ref}
                rows={1}
                onBlur={() => setTimeout(() => setFocused(false), 100)} // to allow press on top buttons
                autoFocus
              />
              <textarea
                className={`resize-none body-base absolute top-0 left-0 right-0 -z-10 opacity-0`}
                value={message}
                disabled
                rows={1}
                ref={cloneRef}
              />
              {!!onSubmit && (
                <div className="self-end flex gap-2 items-center select-none">
                  <button
                    className="flex gap-1 items-center py-1 pr-1 pl-2 rounded-6 body-mini-b text-label-base bg-bg-base disabled:text-label-muted disabled:bg-bg-base"
                    disabled={!message}
                    onClick={onSubmit}
                  >
                    <Trans>Generate</Trans>
                    <KeyboardHint shortcut="entr" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <MarkdownWithCode markdown={message} isCodeStudio side={side} />
              {author === StudioConversationMessageAuthor.ASSISTANT &&
                isLast &&
                isTokenLimitExceeded && (
                  <div
                    className={
                      'flex p-2 gap-2 items-start rounded bg-bg-danger/12 text-bg-danger caption'
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
