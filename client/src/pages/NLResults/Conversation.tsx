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
import { Checkmark, QuillIcon, SendIcon } from '../../icons';

type Props = {
  conversation: ConversationMessage[];
  onNewMessage: (m: string) => void;
  onViewSnippetsClick: (i: number) => void;
  currentlyViewedSnippets: number;
};

const Conversation = ({
  conversation,
  onNewMessage,
  onViewSnippetsClick,
  currentlyViewedSnippets,
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
      if (conversation[conversation.length - 1].isLoading || !newMessage) {
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
          <div
            key={i}
            className={`max-w-[80%] w-fit ${
              message.author === 'user' ? 'self-end' : 'self-start'
            }`}
          >
            <div
              className={`rounded-lg p-3 ${
                message.author === 'user' ? 'bg-gray-700' : 'bg-primary-400'
              }`}
            >
              {message.text || message.error}
            </div>
            {message.isLoading ? (
              'Still generating'
            ) : message.author === 'server' ? (
              <div className="flex items-center justify-between mt-2">
                {i === conversation.length - 1 && (
                  <span className="flex gap-1 items-center text-success-600">
                    <Checkmark />
                    <span className="body-s text-white">Result ready</span>
                  </span>
                )}
                {i !== currentlyViewedSnippets &&
                  conversation[i]?.snippets?.length && (
                    <button
                      className="text-primary-300 body-s mr-2"
                      onClick={() => onViewSnippetsClick(i)}
                    >
                      View
                    </button>
                  )}
              </div>
            ) : (
              ''
            )}
          </div>
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
            <span className="text-gray-500 w-5 h-5 relative after:-top-0.5 after:-bottom-0.5 after:absolute after:-right-1.5 after:w-0.5 after:bg-primary-300 after:rounded-full">
              <QuillIcon />
            </span>
          }
          endIcon={
            <Button onlyIcon variant="tertiary" title="Send" type="submit">
              <SendIcon />
            </Button>
          }
        />
      </form>
    </div>
  );
};

export default Conversation;
