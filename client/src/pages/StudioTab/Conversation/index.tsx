import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Trans } from 'react-i18next';
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
import ConversationInput from './Input';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
  messages: CodeStudioMessageType[];
  studioId: string;
  refetchCodeStudio: () => void;
};

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
  const [conversation, setConversation] = useState<StudioConversationMessage[]>(
    mapConversation(messages),
  );
  const [input, setInput] = useState<StudioConversationMessage>({
    author: StudioConversationMessageAuthor.USER,
    message: '',
  });

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
    });
  }, [studioId, conversation, input]);

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
    <div className="p-8 flex flex-col gap-8">
      {conversation.map((m, i) => (
        <ConversationInput
          key={i}
          author={m.author}
          message={m.message}
          onAuthorChange={onAuthorChange}
          onMessageChange={onMessageChange}
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
