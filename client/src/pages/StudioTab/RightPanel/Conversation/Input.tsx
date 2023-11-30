import React, {
  ChangeEvent,
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../../components/Button';
import {
  ArrowRotate,
  Info,
  PenUnderline,
  Sparkles,
  Template,
  TemplateAdd,
  TrashCanFilled,
} from '../../../../icons';
import { DeviceContext } from '../../../../context/deviceContext';
import {
  StudioConversationMessageAuthor,
  StudioLeftPanelDataType,
  StudioLeftPanelType,
} from '../../../../types/general';
import MarkdownWithCode from '../../../../components/MarkdownWithCode';
import { StudioContext } from '../../../../context/studioContext';
import KeyboardChip from '../../KeyboardChip';
import CopyButton from '../../../../components/MarkdownWithCode/CopyButton';

type Props = {
  author: StudioConversationMessageAuthor;
  message: string;
  onMessageChange: (m: string, i?: number) => void;
  onMessageRemoved?: (i: number, andSubsequent?: boolean) => void;
  i?: number;
  inputRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  setLeftPanel: Dispatch<SetStateAction<StudioLeftPanelDataType>>;
  isTokenLimitExceeded: boolean;
  isLast: boolean;
};

const ConversationInput = ({
  author,
  message,
  onMessageChange,
  i,
  onMessageRemoved,
  inputRef,
  setLeftPanel,
  isLast,
  isTokenLimitExceeded,
}: Props) => {
  const { t } = useTranslation();
  const { envConfig } = useContext(DeviceContext);
  const { refetchTemplates, setTemplates } = useContext(StudioContext.Setters);
  const [isFocused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const cloneRef = useRef<HTMLTextAreaElement | null>(null);
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
      cloneRef.current.style.height = '22px';
      const scrollHeight = cloneRef.current.scrollHeight;

      // We then set the height directly, outside of the render loop
      // Trying to set this with state or a ref will product an incorrect value.
      ref.current.style.height =
        Math.min(Math.max(scrollHeight, 22), 300) + 'px';
    }
  }, [message, isFocused]);

  const saveAsTemplate = useCallback(() => {
    setSaved(true);
    setTemplates((prev) => [
      {
        name: '',
        content: message,
        id: 'new',
        modified_at: '',
        is_default: false,
      },
      ...prev,
    ]);
    setLeftPanel({ type: StudioLeftPanelType.TEMPLATES });
  }, [message, refetchTemplates]);

  const useTemplates = useCallback(() => {
    setLeftPanel({ type: StudioLeftPanelType.TEMPLATES });
  }, []);

  return (
    <div className="flex flex-col p-4 gap-3 rounded-6 border border-transparent hover:shadow-medium hover:border-bg-border-hover focus-within:border-bg-main bg-bg-base hover:focus-within:border-bg-main focus-within:shadow-medium transition-all duration-150 ease-in-out">
      <div className="flex items-center gap-2">
        <span
          className={`h-6 caption flex mr-auto items-center gap-1 flex-shrink-0 pl-1 pr-1.5 ${
            author === StudioConversationMessageAuthor.ASSISTANT
              ? 'bg-studio border border-transparent text-label-control'
              : 'bg-bg-shade border border-bg-border hover:border-bg-border-hover hover:bg-bg-base-hover text-label-title'
          } rounded  transition-all duration-150 ease-in-out select-none cursor-default`}
        >
          {author === 'User' ? (
            <div className="w-4 h-4 rounded-full overflow-hidden bg-chat-bg-border flex items-center justify-center">
              <img src={envConfig.github_user?.avatar_url} alt={t('avatar')} />
            </div>
          ) : (
            <Sparkles raw sizeClassName="w-4 h-4" />
          )}
          {author === StudioConversationMessageAuthor.USER ? (
            envConfig.github_user?.login ? (
              envConfig.github_user?.login
            ) : (
              <Trans>User</Trans>
            )
          ) : (
            'bloop'
          )}
        </span>
        {isFocused || i === undefined ? (
          <div className="flex items-center gap-2">
            <Button size="tiny" variant="secondary" onClick={useTemplates}>
              <Template raw sizeClassName="w-3.5 h-3.5" />
              <Trans>Templates</Trans>
              <div className="flex items-center gap-1 flex-shrink-0">
                <KeyboardChip
                  type="cmd"
                  variant="secondary-light"
                  size="small"
                />
                <KeyboardChip
                  type={'T'}
                  variant="secondary-light"
                  size="small"
                />
              </div>
            </Button>
            {!isSaved && (
              <Button
                variant="secondary"
                size="tiny"
                onClick={saveAsTemplate}
                disabled={!message.length}
              >
                <TemplateAdd raw sizeClassName="w-3.5 h-3.5" />
                <Trans>Save to templates</Trans>
              </Button>
            )}
            {!!message.length && (
              <>
                <Button
                  variant="secondary"
                  size="tiny"
                  onlyIcon
                  title={t('Clear input')}
                  onClick={() => onMessageChange('')}
                  className="opacity-50 hover:opacity-100"
                >
                  <TrashCanFilled raw sizeClassName="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            {author === StudioConversationMessageAuthor.ASSISTANT && (
              <CopyButton
                code={message}
                isInHeader
                className="opacity-50 hover:opacity-100 mr-2"
              />
            )}
            <Button
              variant="secondary"
              size="tiny"
              onlyIcon
              title={t('Edit')}
              onClick={() => setFocused(true)}
              className="mr-2 opacity-50 hover:opacity-100"
            >
              <PenUnderline raw sizeClassName="w-3.5 h-3.5" />
            </Button>
            {author === StudioConversationMessageAuthor.USER && (
              <Button
                variant="secondary"
                size="tiny"
                onlyIcon
                title={t('Retry')}
                onClick={() => onMessageRemoved?.(i, true)}
                className="mr-2 opacity-50 hover:opacity-100"
              >
                <ArrowRotate raw sizeClassName="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              variant="secondary"
              size="tiny"
              onlyIcon
              title={t('Remove')}
              onClick={() => onMessageRemoved?.(i)}
              className="opacity-50 hover:opacity-100"
            >
              <TrashCanFilled raw sizeClassName="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
      <div
        className={`code-studio-md break-words body-s relative ${
          isFocused || i === undefined ? 'flex flex-col' : ''
        }`}
      >
        {isFocused || i === undefined ? (
          <>
            <textarea
              className={`w-full bg-transparent outline-none focus:outline-0 resize-none body-s placeholder:text-label-base`}
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
              className={`resize-none body-s absolute top-0 left-0 right-0 -z-10`}
              value={message}
              disabled
              rows={1}
              ref={cloneRef}
            />
          </>
        ) : (
          <>
            <MarkdownWithCode markdown={message} isCodeStudio />
            {author === StudioConversationMessageAuthor.ASSISTANT &&
              isLast &&
              isTokenLimitExceeded && (
                <div
                  className={
                    'flex p-2 gap-2 items-start rounded bg-bg-danger/12 text-bg-danger caption'
                  }
                >
                  <Info />
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
  );
};

export default memo(ConversationInput);
