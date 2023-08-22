import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
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
import ConversationInput from './Input';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
};

const Conversation = ({ setLeftPanel }: Props) => {
  const [conversation, setConversation] = useState<StudioConversationMessage[]>(
    [],
  );
  const [input, setInput] = useState<StudioConversationMessage>({
    author: StudioConversationMessageAuthor.USER,
    message: '',
  });

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
            <Button size="small" variant="tertiary">
              <TrashCanFilled />
              <Trans>Clear conversation</Trans>
            </Button>
          </div>
          <Button size="small" disabled>
            <Trans>Generate</Trans>
            <div className="flex items-center gap-1 flex-shrink-0">
              <KeyboardChip type="cmd" />
              <KeyboardChip type="entr" />
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(Conversation);
