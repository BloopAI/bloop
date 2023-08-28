import React, {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import { Sparkles, Template, TrashCanFilled } from '../../../icons';
import { DeviceContext } from '../../../context/deviceContext';
import { StudioConversationMessageAuthor } from '../../../types/general';
import MarkdownWithCode from '../../../components/MarkdownWithCode';

type Props = {
  author: StudioConversationMessageAuthor;
  message: string;
  onAuthorChange: (author: StudioConversationMessageAuthor, i?: number) => void;
  onMessageChange: (m: string, i?: number) => void;
  onMessageRemoved?: (i: number) => void;
  i?: number;
  scrollToBottom?: () => void;
};

const ConversationInput = ({
  author,
  message,
  onAuthorChange,
  onMessageChange,
  i,
  onMessageRemoved,
  scrollToBottom,
}: Props) => {
  const { t } = useTranslation();
  const { envConfig } = useContext(DeviceContext);
  const [isFocused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setDragging] = useState(false);

  const handleAuthorSwitch = useCallback(() => {
    onAuthorChange(
      author === StudioConversationMessageAuthor.USER
        ? StudioConversationMessageAuthor.ASSISTANT
        : StudioConversationMessageAuthor.USER,
      i,
    );
  }, [author, i]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onMessageChange(e.target.value, i);
    },
    [i],
  );

  useEffect(() => {
    if (inputRef.current) {
      // We need to reset the height momentarily to get the correct scrollHeight for the textarea
      inputRef.current.style.height = '25px';
      const scrollHeight = inputRef.current.scrollHeight;

      // We then set the height directly, outside of the render loop
      // Trying to set this with state or a ref will product an incorrect value.
      inputRef.current.style.height =
        Math.min(Math.max(scrollHeight, 25), 300) + 'px';
      setTimeout(() => scrollToBottom?.(), 100);
    }
  }, [inputRef.current, message, isFocused]);

  const handleModeChange = useCallback(() => {
    if (!document.getSelection()?.isCollapsed) {
    } else {
      setFocused(true);
    }
  }, []);

  return (
    <div className="flex flex-col p-4 gap-3 rounded-6 border border-transparent hover:shadow-medium hover:border-bg-border-hover focus-within:border-bg-main bg-bg-base hover:focus-within:border-bg-main focus-within:shadow-medium transition-all duration-150 ease-in-out">
      <div className="flex justify-between items-center">
        <button
          onClick={handleAuthorSwitch}
          className="h-6 caption text-label-title flex items-center gap-1 flex-shrink-0 pl-1 pr-1.5 rounded border border-bg-border bg-bg-shade hover:border-bg-border-hover hover:bg-bg-base-hover transition-all duration-150 ease-in-out select-none"
        >
          <div className="w-4 h-4 rounded-full overflow-hidden bg-chat-bg-border flex items-center justify-center">
            {author === 'User' ? (
              <img src={envConfig.github_user?.avatar_url} alt={t('avatar')} />
            ) : (
              <Sparkles raw sizeClassName="w-3.5 h-3.5" />
            )}
          </div>
          <Trans>{author}</Trans>
        </button>
        {isFocused ? (
          <Button size="tiny" variant="secondary">
            <Template raw sizeClassName="w-3.5 h-3.5" />
            <Trans>Use templates</Trans>
          </Button>
        ) : (
          i !== undefined && (
            <Button
              variant="secondary"
              size="tiny"
              onlyIcon
              title={t('Remove')}
              onClick={() => onMessageRemoved?.(i)}
            >
              <TrashCanFilled raw sizeClassName="w-3.5 h-3.5" />
            </Button>
          )
        )}
      </div>
      <div onClick={handleModeChange}>
        {isFocused || !message ? (
          <textarea
            className={`w-full bg-transparent outline-none focus:outline-0 resize-none body-m placeholder:text-label-base`}
            placeholder={t('Start typing...')}
            value={message}
            onChange={handleChange}
            autoComplete="off"
            spellCheck="false"
            ref={inputRef}
            rows={1}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
          />
        ) : (
          <MarkdownWithCode markdown={message} isCodeStudio />
        )}
      </div>
    </div>
  );
};

export default memo(ConversationInput);
