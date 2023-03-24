import React, {
  FormEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ConversationMessage } from '../../types/general';
import { SearchContext } from '../../context/searchContext';
import TextInput from '../../components/TextInput';
import Button from '../../components/Button';
import { QuillIcon, SendIcon } from '../../icons';
import Message from './Message';

type Props = {
  conversation: ConversationMessage[];
  onNewMessage: (m: string) => void;
  onViewSnippetsClick: (i: number) => void;
  currentlyViewedSnippets: number;
  searchId: string;
};

const Conversation = ({
  conversation,
  onNewMessage,
  onViewSnippetsClick,
  currentlyViewedSnippets,
  searchId,
}: Props) => {
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [newMessage, setNewMessage] = useState('');

  const { setInputValue } = useContext(SearchContext);

  useEffect(() => {
    setInputValue('');
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      left: 0,
      top: messagesRef.current?.scrollHeight,
      behavior: 'smooth',
    });
  }, [conversation]);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (
        conversation[conversation.length - 1].isLoading ||
        !newMessage.trim()
      ) {
        return;
      }
      setNewMessage('');
      onNewMessage(newMessage);
    },
    [newMessage, conversation],
  );

  return (
    <div
      className={`p-4 w-96 bg-gray-900 border-l border-gray-800 relative 
    before:absolute before:top-0 before:right-0 before:opacity-50 before:bg-[url('/dust.png')] 
    before:w-full before:h-full before:bg-repeat`}
    >
      <div
        className="relative flex flex-col gap-5 max-h-full pb-20 overflow-auto"
        ref={messagesRef}
      >
        {conversation.map((message, i) => (
          <Message
            key={i}
            message={message}
            onViewSnippetsClick={onViewSnippetsClick}
            currentlyViewedSnippets={currentlyViewedSnippets}
            searchId={searchId}
            i={i}
          />
        ))}
      </div>
      <form
        className="absolute bottom-0 left-0 w-full p-4"
        onSubmit={handleSubmit}
      >
        <TextInput
          ref={inputRef}
          value={newMessage}
          name="message"
          placeholder="Ask a question..."
          onChange={(e) => setNewMessage(e.target.value)}
          variant="filled"
          high
          startIcon={
            <span className="text-gray-500 w-5 h-5">
              <QuillIcon />
            </span>
          }
          endIcon={
            conversation[conversation.length - 1].isLoading ? undefined : (
              <Button onlyIcon variant="tertiary" title="Send" type="submit">
                <SendIcon />
              </Button>
            )
          }
        />
      </form>
    </div>
  );
};

export default Conversation;
