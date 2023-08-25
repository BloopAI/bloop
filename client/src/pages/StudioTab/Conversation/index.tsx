import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
import ConversationInput from './Input';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
  messages: CodeStudioMessageType[];
  studioId: string;
  refetchCodeStudio: () => void;
};

let eventSource: EventSource;

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
}: Props) => {
  useTranslation();
  const [conversation, setConversation] = useState<StudioConversationMessage[]>(
    mapConversation(messages),
  );
  const [input, setInput] = useState<StudioConversationMessage>({
    author: StudioConversationMessageAuthor.USER,
    message: '',
  });
  const { apiUrl } = useContext(DeviceContext);

  useEffect(() => {
    setConversation(mapConversation(messages));
  }, [messages]);

  const onAuthorChange = useCallback(
    (author: StudioConversationMessageAuthor, i?: number) => {
      if (i === undefined) {
        setInput((prev) => ({ ...prev, author }));
      } else {
        setConversation((prev) => {
          const newConv = JSON.parse(JSON.stringify(prev));
          newConv[i].author = author;
          return newConv;
        });
      }
    },
    [],
  );
  const onMessageChange = useCallback((message: string, i?: number) => {
    if (i === undefined) {
      setInput((prev) => ({ ...prev, message }));
    } else {
      setConversation((prev) => {
        const newConv = JSON.parse(JSON.stringify(prev));
        newConv[i].message = message;
        return newConv;
      });
    }
  }, []);

  const onSubmit = useCallback(() => {
    if (!input.message) {
      return;
    }
    const messages = conversation
      .map((c) => ({ [c.author]: c.message }))
      .concat([{ [input.author]: input.message }]);
    patchCodeStudio(studioId, {
      messages,
    }).then(() => {
      refetchCodeStudio();
      setInput({
        author: StudioConversationMessageAuthor.USER,
        message: '',
      });
      eventSource?.close();
      eventSource = new EventSource(
        `${apiUrl.replace('https:', '')}/studio/${studioId}/generate`,
      );
      eventSource.onerror = (err) => {
        console.log('SSE error', err);
        eventSource.close();
      };
      let i = 0;
      eventSource.onmessage = (ev) => {
        console.log(ev.data);
        if (ev.data === '[DONE]') {
          eventSource.close();
          return;
        }
        try {
          const data = JSON.parse(ev.data);
          if (data.Ok) {
            const newMessage = data.Ok;
            setConversation((prev) =>
              i === 0
                ? [
                    ...prev,
                    {
                      author: StudioConversationMessageAuthor.ASSISTANT,
                      message: newMessage,
                    },
                  ]
                : [
                    ...prev.slice(0, -1),
                    {
                      author: StudioConversationMessageAuthor.ASSISTANT,
                      message: newMessage,
                    },
                  ],
            );
            i++;
          } else if (data.Err) {
            setConversation((prev) => {
              return [
                ...prev,
                {
                  author: StudioConversationMessageAuthor.ASSISTANT,
                  message: data.Err,
                },
              ];
            });
          }
        } catch (err) {
          console.log('failed to parse response', err);
        }
      };
    });
  }, [studioId, conversation, input]);

  const onMessageRemoved = useCallback((i: number) => {
    const messages = conversation
      .map((c) => ({ [c.author]: c.message }))
      .filter((m, j) => i !== j);
    patchCodeStudio(studioId, {
      messages,
    }).then(() => {
      refetchCodeStudio();
    });
  }, []);

  const handleClearConversation = useCallback(() => {
    patchCodeStudio(studioId, {
      messages: [],
    }).then(() => {
      refetchCodeStudio();
      setInput({
        author: StudioConversationMessageAuthor.USER,
        message: '',
      });
    });
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
    <div className="p-8 flex flex-col gap-8 overflow-auto">
      <div className="flex flex-col gap-3">
        {conversation.map((m, i) => (
          <ConversationInput
            key={i}
            author={m.author}
            message={m.message}
            onAuthorChange={onAuthorChange}
            onMessageChange={onMessageChange}
            onMessageRemoved={onMessageRemoved}
            i={i}
          />
        ))}
        <ConversationInput
          key={'new'}
          author={input.author}
          message={input.message}
          onAuthorChange={onAuthorChange}
          onMessageChange={onMessageChange}
        />
      </div>
      <div className="px-4 flex flex-col gap-8">
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
          <Button size="small" disabled={!input.message} onClick={onSubmit}>
            <Trans>Generate</Trans>
            <div className="flex items-center gap-1 flex-shrink-0">
              <KeyboardChip
                type="cmd"
                variant={!input.message ? 'secondary' : 'primary'}
              />
              <KeyboardChip
                type="entr"
                variant={!input.message ? 'secondary' : 'primary'}
              />
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(Conversation);
