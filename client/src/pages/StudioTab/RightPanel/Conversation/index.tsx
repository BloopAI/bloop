import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import throttle from 'lodash.throttle';
import {
  StudioConversationMessage,
  StudioConversationMessageAuthor,
  StudioLeftPanelType,
  StudioLeftPanelDataType,
} from '../../../../types/general';
import Button from '../../../../components/Button';
import { ArrowRefresh, TrashCanFilled } from '../../../../icons';
import KeyboardChip from '../../KeyboardChip';
import { CodeStudioMessageType, CodeStudioType } from '../../../../types/api';
import { patchCodeStudio } from '../../../../services/api';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import { DeviceContext } from '../../../../context/deviceContext';
import useScrollToBottom from '../../../../hooks/useScrollToBottom';
import { StudioContext } from '../../../../context/studioContext';
import { PersonalQuotaContext } from '../../../../context/personalQuotaContext';
import { UIContext } from '../../../../context/uiContext';
import ConversationInput from './Input';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioLeftPanelDataType>>;
  setIsHistoryOpen: Dispatch<SetStateAction<boolean>>;
  messages: CodeStudioMessageType[];
  studioId: string;
  refetchCodeStudio: (keyToUpdate?: keyof CodeStudioType) => Promise<void>;
  isTokenLimitExceeded: boolean;
  isPreviewing: boolean;
  isActiveTab: boolean;
  handleRestore: () => void;
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
  isTokenLimitExceeded,
  setIsHistoryOpen,
  isPreviewing,
  handleRestore,
  isActiveTab,
  refetchCodeStudio,
}: Props) => {
  const { t } = useTranslation();
  const { inputValue } = useContext(StudioContext.Input);
  const { setUpgradePopupOpen } = useContext(UIContext.UpgradePopup);
  const { setInputValue } = useContext(StudioContext.Setters);
  const { refetchQuota } = useContext(PersonalQuotaContext.Handlers);
  const { requestsLeft } = useContext(PersonalQuotaContext.Values);
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
  const [isLoading, setIsLoading] = useState(false);
  const { apiUrl } = useContext(DeviceContext);
  const { messagesRef, handleScroll, scrollToBottom } =
    useScrollToBottom(conversation);

  useEffect(() => {
    const mappedConv = mapConversation(messages);
    if (
      mappedConv[mappedConv.length - 1]?.author ===
        StudioConversationMessageAuthor.USER &&
      !isPreviewing
    ) {
      const editedMessage = mappedConv[messages.length - 1];
      setInputValue((prev) =>
        prev < editedMessage.message ? editedMessage.message : prev,
      );
      setConversation(mappedConv.slice(0, -1));
    } else {
      setConversation(mappedConv);
    }
  }, [messages]);

  const saveConversation = useCallback(
    async (
      force?: boolean,
      newConversation?: StudioConversationMessage[],
      newInput?: string,
    ) => {
      const messages: ({ User: string } | { Assistant: string })[] = (
        newConversation || conversation
      )
        .map((c) => ({ [c.author as 'User']: c.message }))
        .concat(
          !newConversation && (newInput || inputValue)
            ? [{ [inputAuthor as 'User']: newInput || inputValue }]
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

  const onMessageChange = useCallback(
    (message: string, i?: number) => {
      if (i === undefined) {
        setInputValue(message);
        saveConversation(false, undefined, message);
      } else {
        setConversation((prev) => {
          const newConv = JSON.parse(JSON.stringify(prev));
          newConv[i].message = message;
          saveConversation(false, newConv);
          return newConv;
        });
      }
    },
    [saveConversation],
  );

  const handleCancel = useCallback(() => {
    eventSource?.close();
    setIsLoading(false);
    refetchQuota();
    if (
      conversation[conversation.length - 1]?.author ===
      StudioConversationMessageAuthor.USER
    ) {
      const editedMessage = conversation[conversation.length - 1];
      setInputValue((prev) =>
        prev < editedMessage.message ? editedMessage.message : prev,
      );
      setConversation(conversation.slice(0, -1));
      saveConversation(false, conversation.slice(0, -1));
    } else {
      saveConversation();
    }
  }, [conversation]);

  const onSubmit = useCallback(async () => {
    if (!inputValue) {
      return;
    }
    await saveConversation(true);
    if (!requestsLeft) {
      setUpgradePopupOpen(true);
      return;
    }
    setConversation((prev) => [
      ...prev,
      { message: inputValue, author: inputAuthor },
    ]);
    setInput({
      author: StudioConversationMessageAuthor.USER,
      message: '',
    });
    setIsLoading(true);

    eventSource?.close();
    eventSource = new EventSource(
      `${apiUrl.replace('https:', '')}/studio/${studioId}/generate`,
    );
    eventSource.onerror = (err) => {
      console.log('SSE error', err);
      refetchQuota();
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
      setIsLoading(false);
      eventSource.close();
    };
    let i = 0;
    eventSource.onmessage = (ev) => {
      if (ev.data === '[DONE]') {
        eventSource.close();
        setIsLoading(false);
        refetchCodeStudio();
        return;
      }
      try {
        const data = JSON.parse(ev.data);
        if (data.Ok) {
          const newMessage = data.Ok;
          if (i === 0) {
            refetchQuota();
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
          refetchQuota();
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
        setIsLoading(false);
        console.log('failed to parse response', err);
      }
    };
  }, [
    studioId,
    conversation,
    inputValue,
    inputAuthor,
    saveConversation,
    requestsLeft,
  ]);

  const onMessageRemoved = useCallback(
    async (i: number, andSubsequent?: boolean) => {
      if (andSubsequent) {
        // Set input to the message being removed
        setInput(conversation[i]);
      }
      setConversation((prev) => {
        const newConv = prev.filter((_, j) =>
          andSubsequent ? i > j : i !== j,
        );
        if (
          newConv[newConv.length - 1]?.author ===
          StudioConversationMessageAuthor.USER
        ) {
          const editedMessage = newConv[messages.length - 1];
          setInputValue(editedMessage.message);
          return newConv.slice(0, -1);
        }
        return newConv;
      });

      const messages: ({ User: string } | { Assistant: string })[] =
        conversation
          .map((c) => ({ [c.author as 'User']: c.message }))
          .filter((m, j) => (andSubsequent ? i > j : i !== j));
      await patchCodeStudio(studioId, {
        messages,
      }).then(() => {
        refetchCodeStudio('token_counts');
      });
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
    setConversation([]);
  }, [studioId]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (isPreviewing) {
          handleRestore();
        } else {
          if (inputValue && !isTokenLimitExceeded && requestsLeft) {
            onSubmit();
          } else if (!requestsLeft) {
            setUpgradePopupOpen(true);
          }
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        setLeftPanel({ type: StudioLeftPanelType.TEMPLATES });
      }
      if (e.key === 'Escape' && isLoading) {
        handleCancel();
      }
    },
    [onSubmit, isLoading, setLeftPanel, isPreviewing],
  );
  useKeyboardNavigation(handleKeyEvent, !isActiveTab);

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
              onMessageChange={onMessageChange}
              onMessageRemoved={onMessageRemoved}
              i={i}
              setLeftPanel={setLeftPanel}
            />
          ))}
          {!isLoading &&
            !isPreviewing &&
            !(
              conversation[conversation.length - 1]?.author ===
              StudioConversationMessageAuthor.USER
            ) && (
              <ConversationInput
                key={'new'}
                author={inputAuthor}
                message={inputValue}
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
        {isPreviewing ? (
          <div className="flex items-center justify-end">
            <Button onClick={handleRestore} size="small">
              <Trans>Restore</Trans>
              <div className="flex items-center gap-1 flex-shrink-0">
                <KeyboardChip type="cmd" variant={'primary'} />
                <KeyboardChip type="entr" variant={'primary'} />
              </div>
            </Button>
          </div>
        ) : (
          <div className="flex justify-between items-center flex-wrap gap-1">
            <div className="flex items-center gap-3">
              <Button
                size="small"
                variant="secondary"
                onClick={() => setIsHistoryOpen((prev) => !prev)}
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
              {isLoading ? (
                <Button size="small" onClick={handleCancel} variant="danger">
                  <Trans>Stop generating</Trans>
                  <KeyboardChip type="Esc" variant="danger" />
                </Button>
              ) : (
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(Conversation);
