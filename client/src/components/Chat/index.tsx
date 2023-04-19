import React, {
  FormEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import { CloseSign, List } from '../../icons';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageType,
} from '../../types/general';
import { RepositoriesContext } from '../../context/repositoriesContext';
import NLInput from './NLInput';
import ChipButton from './ChipButton';
import AllConversations from './AllCoversations';
import Conversation from './Conversation';

let prevEventSource: EventSource | undefined;

const Chat = () => {
  const { isRightPanelOpen, setRightPanelOpen } = useContext(UIContext);
  const { apiUrl } = useContext(DeviceContext);
  const { repositories } = useContext(RepositoriesContext);
  const [isActive, setActive] = useState(false);
  const chatRef = useRef(null);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  useOnClickOutside(chatRef, () => setActive(false));

  useEffect(() => {
    if (isActive) {
      document.getElementById('question-input')?.focus();
    }
  }, [isActive]);

  const makeSearch = useCallback(
    (query: string) => {
      prevEventSource?.close();
      setInputValue('');
      const eventSource = new EventSource(
        `${apiUrl.replace('https:', '')}/answer?q=${query}&repo_ref=${
          repositories?.[0]?.ref
        }`,
      );
      prevEventSource = eventSource;
      eventSource.onmessage = (ev) => {
        if (ev.data === '[DONE]') {
          eventSource.close();
          prevEventSource = undefined;
          setConversation((prev) => {
            const newConversation = prev.slice(0, -1);
            const lastMessage = {
              ...prev.slice(-1)[0],
              isLoading: false,
            };
            return [...newConversation, lastMessage];
          });
          return;
        }
        const data = JSON.parse(ev.data);
        if (data.Ok) {
          if (typeof data.Ok === 'string') {
            setConversation((prev) => {
              const newConversation = prev?.slice(0, -1) || [];
              const lastMessage = prev?.slice(-1)[0];
              const lastMessages: ChatMessage[] =
                lastMessage?.author === ChatMessageAuthor.Server &&
                lastMessage?.isLoading
                  ? [
                      {
                        author: ChatMessageAuthor.Server,
                        isLoading: true,
                        type: ChatMessageType.Answer,
                        loadingSteps: [...lastMessage.loadingSteps, data.Ok],
                      },
                    ]
                  : [
                      ...prev.slice(-1),
                      {
                        author: ChatMessageAuthor.Server,
                        isLoading: true,
                        type: ChatMessageType.Answer,
                        loadingSteps: [data.Ok],
                      },
                    ];
              return [...newConversation, ...lastMessages];
            });
          } else if (data.Ok.Answer) {
            setConversation((prev) => {
              const newConversation = prev.slice(0, -1);
              const lastMessage = {
                ...prev.slice(-1)[0],
                text: JSON.stringify(data.Ok.Answer),
              };
              return [...newConversation, lastMessage];
            });
          } else if (data.Ok.Prompt) {
            setConversation((prev) => {
              const newConversation = prev.slice(0, -1);
              const lastMessage = {
                ...prev.slice(-1)[0],
                isLoading: false,
              };
              return [
                ...newConversation,
                lastMessage,
                {
                  author: ChatMessageAuthor.Server,
                  isLoading: false,
                  type: ChatMessageType.Prompt,
                  text: data.Ok.Prompt,
                  loadingSteps: [],
                },
              ];
            });
          }
        } else if (data.Err) {
          setConversation((prev) => {
            const newConversation = prev.slice(0, -1);
            const lastMessage = {
              ...prev.slice(-1)[0],
              isLoading: false,
              error: data.Err,
            };
            return [...newConversation, lastMessage];
          });
        }
      };
    },
    [repositories],
  );

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setConversation((prev) => [
        ...prev,
        { author: ChatMessageAuthor.User, text: inputValue, isLoading: false },
      ]);
      makeSearch(inputValue);
    },
    [inputValue],
  );

  return (
    <>
      <button
        className={`fixed z-50 bottom-20 w-13 h-13 rounded-full cursor-pointer ${
          isActive || isRightPanelOpen ? '-right-full' : 'right-8'
        } border border-gray-600 bg-gray-700 transition-all duration-300 ease-out-slow`}
        onClick={() => setActive(true)}
      >
        {/*<div>chat</div>*/}
      </button>
      <div
        ref={chatRef}
        className={`fixed z-50 bottom-20 rounded-xl group w-97 max-h-[30rem] flex flex-col justify-end ${
          !isActive || isRightPanelOpen ? '-right-full' : 'right-8'
        } backdrop-blur-6 shadow-small bg-gray-800/50 transition-all duration-300 ease-out-slow`}
      >
        <div className="w-full max-h-0 group-hover:max-h-96 transition-all duration-200 overflow-hidden flex-shrink-0">
          <div className="px-4 pt-4 flex flex-col">
            <div className="flex justify-between gap-1 items-center">
              <ChipButton
                onClick={() => {
                  setRightPanelOpen(true);
                }}
              >
                <List /> All conversations
              </ChipButton>
              <ChipButton variant="filled" onClick={() => setActive(false)}>
                <CloseSign sizeClassName="w-3.5 h-3.5" />
              </ChipButton>
            </div>
          </div>
        </div>
        <div className="p-4">
          {!!conversation.length && (
            <Conversation conversation={conversation} />
          )}
          <form onSubmit={onSubmit} className="flex flex-col w-95">
            <NLInput
              id="question-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </form>
        </div>
      </div>
      <AllConversations
        setHistoryOpen={setRightPanelOpen}
        isHistoryOpen={isRightPanelOpen}
        setActive={setActive}
      />
    </>
  );
};

export default Chat;
