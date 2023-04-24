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
  ChatMessageServer,
  ChatMessageType,
} from '../../types/general';
import { AppNavigationContext } from '../../context/appNavigationContext';
import { ChatContext } from '../../context/chatContext';
import NLInput from './NLInput';
import ChipButton from './ChipButton';
import AllConversations from './AllCoversations';
import Conversation from './Conversation';

let prevEventSource: EventSource | undefined;

const focusInput = () => {
  document.getElementById('question-input')?.focus();
};

const blurInput = () => {
  document.getElementById('question-input')?.blur();
};

const Chat = () => {
  const { isRightPanelOpen, setRightPanelOpen, tab } = useContext(UIContext);
  const { apiUrl } = useContext(DeviceContext);
  const { conversation, setConversation } = useContext(ChatContext);
  const { navigateConversationResults, navigateRepoPath } =
    useContext(AppNavigationContext);
  const [isActive, setActive] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const chatRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [threadId, setThreadId] = useState('');
  const [resp, setResp] = useState<{ thread_id: string } | null>(null);
  useOnClickOutside(chatRef, () => setActive(false));

  useEffect(() => {
    if (isActive) {
      focusInput();
    }
  }, [isActive]);

  useEffect(() => {
    const lastMessage = conversation[conversation.length - 1];
    if (
      lastMessage?.author === ChatMessageAuthor.Server &&
      lastMessage.results?.length
    ) {
      navigateConversationResults(conversation.length - 1);
    }
  }, [conversation]);

  const makeSearch = useCallback(
    (query: string) => {
      prevEventSource?.close();
      setInputValue('');
      setLoading(true);
      const eventSource = new EventSource(
        `${apiUrl.replace('https:', '')}/answer?q=${query}&repo_ref=${tab.key}${
          threadId ? `&thread_id=${threadId}` : ''
        }`,
      );
      prevEventSource = eventSource;
      eventSource.onerror = (err) => {
        console.log(err);
      };
      eventSource.onmessage = (ev) => {
        console.log(ev.data);
        if (ev.data === '[DONE]') {
          eventSource.close();
          prevEventSource = undefined;
          setLoading(false);
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
          setResp(data.Ok);
          setThreadId(data.Ok.thread_id);
          const newMessage = data.Ok.messages[0];
          setConversation((prev) => {
            const newConversation = prev?.slice(0, -1) || [];
            const lastMessage = prev?.slice(-1)[0];
            const messageToAdd = {
              author: ChatMessageAuthor.Server,
              isLoading: newMessage.status === 'LOADING',
              type: ChatMessageType.Answer,
              loadingSteps: newMessage.search_steps.map(
                (s: { [key: string]: string | string[] }) =>
                  Array.isArray(Object.values(s)[0])
                    ? Object.values(s)[0][1]
                    : Object.values(s)[0],
              ),
              text: newMessage.content,
              results: newMessage.results,
            };
            const lastMessages: ChatMessage[] =
              lastMessage?.author === ChatMessageAuthor.Server
                ? [messageToAdd]
                : [...prev.slice(-1), messageToAdd];
            return [...newConversation, ...lastMessages];
          });
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
    [tab, threadId],
  );

  const stopGenerating = useCallback(() => {
    prevEventSource?.close();
    setConversation((prev) => {
      const newConversation = prev.slice(0, -1);
      const lastMessage = {
        ...prev.slice(-1)[0],
        isLoading: false,
      };
      return [...newConversation, lastMessage];
    });
    focusInput();
  }, []);

  const onSubmit = useCallback(
    (e?: FormEvent) => {
      if (e?.preventDefault) {
        e.preventDefault();
      }
      if (
        (conversation[conversation.length - 1] as ChatMessageServer)
          ?.isLoading ||
        !inputValue.trim()
      ) {
        return;
      }
      blurInput();
      setConversation((prev) => [
        ...prev,
        { author: ChatMessageAuthor.User, text: inputValue, isLoading: false },
      ]);
      makeSearch(inputValue);
    },
    [inputValue, conversation],
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
              <div className="flex items-center gap-1">
                <ChipButton
                  onClick={() => {
                    setConversation([]);
                    setThreadId('');
                    navigateRepoPath(tab.name);
                    focusInput();
                  }}
                >
                  Create new
                </ChipButton>
                <ChipButton variant="filled" onClick={() => setActive(false)}>
                  <CloseSign sizeClassName="w-3.5 h-3.5" />
                </ChipButton>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4">
          {!!conversation.length && (
            <Conversation
              conversation={conversation}
              searchId={resp?.thread_id || ''}
              isLoading={isLoading}
            />
          )}
          <form onSubmit={onSubmit} className="flex flex-col w-95">
            <NLInput
              id="question-input"
              value={inputValue}
              onSubmit={onSubmit}
              onChange={(e) => setInputValue(e.target.value)}
              isStoppable={
                (conversation[conversation.length - 1] as ChatMessageServer)
                  ?.isLoading
              }
              onStop={stopGenerating}
              placeholder={
                (conversation[conversation.length - 1] as ChatMessageServer)
                  ?.isLoading
                  ? (conversation[conversation.length - 1] as ChatMessageServer)
                      ?.loadingSteps?.[
                      (
                        conversation[
                          conversation.length - 1
                        ] as ChatMessageServer
                      )?.loadingSteps?.length - 1
                    ]
                  : undefined
              }
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
