import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import throttle from 'lodash.throttle';
import {
  StudioConversationMessage,
  StudioConversationMessageAuthor,
  StudioLeftPanelType,
  StudioPanelDataType,
} from '../../../types/general';
import Button from '../../../components/Button';
import { ArrowRefresh, TrashCanFilled } from '../../../icons';
import KeyboardChip from '../KeyboardChip';
import { CodeStudioMessageType } from '../../../types/api';
import { patchCodeStudio } from '../../../services/api';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { DeviceContext } from '../../../context/deviceContext';
import useScrollToBottom from '../../../hooks/useScrollToBottom';
import { StudioContext } from '../../../context/studioContext';
import ConversationInput from './Input';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
  messages: CodeStudioMessageType[];
  studioId: string;
  refetchCodeStudio: () => Promise<void>;
  isTokenLimitExceeded: boolean;
};

let eventSource: EventSource;

const throttledPatch = throttle(
  (studioId, data) => {
    return patchCodeStudio(studioId, data);
  },
  2000,
  { leading: false, trailing: true },
);

function mapConversation(
  messages: CodeStudioMessageType[],
): StudioConversationMessage[] {
  return messages.map((m) => {
    const author = Object.keys(m)[0] as StudioConversationMessageAuthor;
    return { author, message: Object.values(m)[0] };
  });
}

const Conversation = ({
  setLeftPanel,
  messages,
  studioId,
  refetchCodeStudio,
  isTokenLimitExceeded,
}: Props) => {
  const { t } = useTranslation();
  const { inputValue } = useContext(StudioContext.Input);
  const { setInputValue } = useContext(StudioContext.Setters);
  const [conversation, setConversation] = useState<StudioConversationMessage[]>(
    mapConversation(messages),
  );
  const [inputAuthor, setInputAuthor] = useState(
    StudioConversationMessageAuthor.USER,
  );
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const setInput = (value: StudioConversationMessage) => {
    setInputValue(value.message);
    setInputAuthor(value.author);
    // Focus on the input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  const [loading, setLoading] = useState(false);
  const { apiUrl } = useContext(DeviceContext);
  const { messagesRef, handleScroll, scrollToBottom } =
    useScrollToBottom(conversation);

  useEffect(() => {
    setConversation(mapConversation(messages));
  }, [messages]);

  const saveConversation = useCallback(
    async (force?: boolean, newConversation?: StudioConversationMessage[]) => {
      const messages: ({ User: string } | { Assistant: string })[] = (
        newConversation || conversation
      )
        .map((c) => ({ [c.author as 'User']: c.message }))
        .concat(
          !newConversation && inputValue
            ? [{ [inputAuthor as 'User']: inputValue }]
            : [],
        );
      if (force) {
        await patchCodeStudio(studioId, {
          messages,
        });
      } else {
        throttledPatch(studioId, {
          messages,
        });
      }
    },
    [conversation, inputValue, inputAuthor],
  );

  const onAuthorChange = useCallback(
    (author: StudioConversationMessageAuthor, i?: number) => {
      if (i === undefined) {
        setInputAuthor(author);
      } else {
        setConversation((prev) => {
          const newConv = JSON.parse(JSON.stringify(prev));
          newConv[i].author = author;
          return newConv;
        });
      }
      saveConversation();
    },
    [saveConversation],
  );
  const onMessageChange = useCallback(
    (message: string, i?: number) => {
      if (i === undefined) {
        setInputValue(message);
      } else {
        setConversation((prev) => {
          const newConv = JSON.parse(JSON.stringify(prev));
          newConv[i].message = message;
          return newConv;
        });
      }
      saveConversation();
    },
    [saveConversation],
  );

  const handleCancel = useCallback(() => {
    eventSource?.close();
    setLoading(false);
  }, []);

  const onSubmit = useCallback(async () => {
    if (!inputValue) {
      return;
    }
    await saveConversation(true);
    await refetchCodeStudio();
    setInput({
      author: StudioConversationMessageAuthor.USER,
      message: '',
    });
    setLoading(true);

    eventSource?.close();
    eventSource = new EventSource(
      `${apiUrl.replace('https:', '')}/studio/${studioId}/generate`,
    );
    eventSource.onerror = (err) => {
      console.log('SSE error', err);
      setConversation((prev) => {
        const newConv = [
          ...prev,
          {
            author: StudioConversationMessageAuthor.ASSISTANT,
            message: '',
            error: t(
              "We couldn't answer your question. You can try asking again in a few moments, or rephrasing your question.",
            ),
          },
        ];
        saveConversation(false, newConv);
        return newConv;
      });
      eventSource.close();
    };
    let i = 0;
    eventSource.onmessage = (ev) => {
      if (ev.data === '[DONE]') {
        eventSource.close();
        setLoading(false);
        return;
      }
      try {
        const data = JSON.parse(ev.data);
        if (data.Ok) {
          const newMessage = data.Ok;
          if (i === 0) {
            setConversation((prev) => {
              const newConv = [
                ...prev,
                {
                  author: StudioConversationMessageAuthor.ASSISTANT,
                  message: newMessage,
                },
              ];
              saveConversation(false, newConv);
              return newConv;
            });
          } else {
            setConversation((prev) => {
              const newConv = [
                ...prev.slice(0, -1),
                {
                  author: StudioConversationMessageAuthor.ASSISTANT,
                  message: newMessage,
                },
              ];
              saveConversation(false, newConv);
              return newConv;
            });
          }
          i++;
        } else if (data.Err) {
          setConversation((prev) => {
            const newConv = [
              ...prev,
              {
                author: StudioConversationMessageAuthor.ASSISTANT,
                message: data.Err,
              },
            ];
            saveConversation(false, newConv);
            return newConv;
          });
        }
      } catch (err) {
        setLoading(false);
        console.log('failed to parse response', err);
      }
    };
  }, [studioId, conversation, inputValue, saveConversation]);

  const onMessageRemoved = useCallback(
    async (i: number, andSubsequent?: boolean) => {
      if (andSubsequent) {
        // Set input to the message being removed
        setInput(conversation[i]);
      }

      const messages: ({ User: string } | { Assistant: string })[] =
        conversation
          .map((c) => ({ [c.author as 'User']: c.message }))
          .filter((m, j) => (andSubsequent ? i > j : i !== j));
      await patchCodeStudio(studioId, {
        messages,
      });
      await refetchCodeStudio();
    },
    [conversation],
  );

  const handleClearConversation = useCallback(async () => {
    await patchCodeStudio(studioId, {
      messages: [],
    });
    setInput({
      author: StudioConversationMessageAuthor.USER,
      message: '',
    });
    await refetchCodeStudio();
  }, [studioId, refetchCodeStudio]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        onSubmit();
      }
    },
    [onSubmit],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <div className="px-7 flex flex-col overflow-auto h-full">
      <div
        className="fade-bottom overflow-auto"
        ref={messagesRef}
        onScroll={handleScroll}
      >
        <div className="flex flex-col gap-3 py-8 px-1">
          {conversation.map((m, i) => (
            <ConversationInput
              key={i}
              author={m.author}
              message={m.error || m.message}
              onAuthorChange={onAuthorChange}
              onMessageChange={onMessageChange}
              onMessageRemoved={onMessageRemoved}
              i={i}
              setLeftPanel={setLeftPanel}
            />
          ))}
          {!loading && (
            <ConversationInput
              key={'new'}
              author={inputAuthor}
              message={inputValue}
              onAuthorChange={onAuthorChange}
              onMessageChange={onMessageChange}
              scrollToBottom={scrollToBottom}
              inputRef={inputRef}
              setLeftPanel={setLeftPanel}
            />
          )}
        </div>
      </div>
      <div className="px-4 flex flex-col gap-8 pb-8 mt-auto">
        <hr className="border-bg-border" />
        <div className="flex justify-between items-center flex-wrap gap-1">
          <div className="flex items-center gap-3">
            <Button
              size="small"
              variant="secondary"
              onClick={() =>
                setLeftPanel({ type: StudioLeftPanelType.HISTORY })
              }
            >
              <ArrowRefresh />
              <Trans>View history</Trans>
            </Button>
            <Button
              size="small"
              variant="tertiary"
              onClick={handleClearConversation}
            >
              <TrashCanFilled />
              <Trans>Clear conversation</Trans>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {loading && (
              <Button
                size="small"
                variant="tertiary-outlined"
                onClick={handleCancel}
              >
                <Trans>Cancel</Trans>
              </Button>
            )}

            <Button
              size="small"
              disabled={!inputValue || isTokenLimitExceeded}
              onClick={onSubmit}
            >
              <Trans>Generate</Trans>
              <div className="flex items-center gap-1 flex-shrink-0">
                <KeyboardChip
                  type="cmd"
                  variant={
                    !inputValue || isTokenLimitExceeded
                      ? 'secondary'
                      : 'primary'
                  }
                />
                <KeyboardChip
                  type="entr"
                  variant={
                    !inputValue || isTokenLimitExceeded
                      ? 'secondary'
                      : 'primary'
                  }
                />
              </div>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Conversation);
