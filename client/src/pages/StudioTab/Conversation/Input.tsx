import React, {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import {
  Sparkles,
  Template,
  TrashCanFilled,
  ArrowRotate,
  PenUnderline,
} from '../../../icons';
import { DeviceContext } from '../../../context/deviceContext';
import { StudioConversationMessageAuthor } from '../../../types/general';
import MarkdownWithCode from '../../../components/MarkdownWithCode';

type Props = {
  author: StudioConversationMessageAuthor;
  message: string;
  onAuthorChange: (author: StudioConversationMessageAuthor, i?: number) => void;
  onMessageChange: (m: string, i?: number) => void;
  onMessageRemoved?: (i: number, andSubsequent?: boolean) => void;
  i?: number;
  scrollToBottom?: () => void;
  inputRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
};

const ConversationInput = ({
  author,
  message,
  onAuthorChange,
  onMessageChange,
  i,
  onMessageRemoved,
  scrollToBottom,
  inputRef,
}: Props) => {
  const { t } = useTranslation();
  const { envConfig } = useContext(DeviceContext);
  const [isFocused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const cloneRef = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(inputRef, () => ref.current!);

  const handleAuthorSwitch = useCallback(() => {
    onAuthorChange(
      author === StudioConversationMessageAuthor.USER
        ? StudioConversationMessageAuthor.ASSISTANT
        : StudioConversationMessageAuthor.USER,
      i,
    );
  }, [author, i, onAuthorChange]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onMessageChange(e.target.value, i);
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
      setTimeout(() => scrollToBottom?.(), 10);
    }
  }, [message, isFocused]);

  return (
    <div className="flex flex-col p-4 gap-3 rounded-6 border border-transparent hover:shadow-medium hover:border-bg-border-hover focus-within:border-bg-main bg-bg-base hover:focus-within:border-bg-main focus-within:shadow-medium transition-all duration-150 ease-in-out">
      <div className="flex">
        <button
          onClick={handleAuthorSwitch}
          className="h-6 caption text-label-title flex items-center gap-1 flex-shrink-0 pl-1 pr-1.5 rounded border border-bg-border bg-bg-shade hover:border-bg-border-hover hover:bg-bg-base-hover transition-all duration-150 ease-in-out select-none"
        >
          <div className="w-4 h-4 rounded-full overflow-hidden bg-chat-bg-border flex items-center justify-center">
            {author === 'User' ? (
              <img src={envConfig.github_user?.avatar_url} alt={t('avatar')} />
            ) : (
              <Sparkles raw sizeClassName="w-2.5 h-2.5" />
            )}
          </div>
          <Trans>{author}</Trans>
        </button>
        <span className="ml-auto" />
        {isFocused ? (
          <>
            <Button size="tiny" variant="secondary">
              <Template raw sizeClassName="w-3.5 h-3.5" />
              <Trans>Use templates</Trans>
            </Button>
          </>
        ) : (
          i !== undefined && (
            <>
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
              {author === 'User' && (
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
          )
        )}
      </div>
      <div
        className={`code-studio-md body-s relative ${
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
              onBlur={() => setFocused(false)}
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
          <MarkdownWithCode markdown={message} isCodeStudio />
        )}
      </div>
    </div>
  );
};

export default memo(ConversationInput);
