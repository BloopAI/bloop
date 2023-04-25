import React, {
  FormEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import { CloseSign, List, LiteLoader, Sparkle } from '../../icons';
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
  const {
    conversation,
    setConversation,
    isChatOpen,
    setChatOpen,
    setShowTooltip,
    showTooltip,
    tooltipText,
  } = useContext(ChatContext);
  const { navigateConversationResults, navigateRepoPath } =
    useContext(AppNavigationContext);
  const [isLoading, setLoading] = useState(false);
  const chatRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [threadId, setThreadId] = useState('');
  const [resp, setResp] = useState<{ thread_id: string } | null>(null);
  useOnClickOutside(chatRef, () => setChatOpen(false));

  useEffect(() => {
    if (isChatOpen) {
      focusInput();
    }
  }, [isChatOpen]);

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
      let firstResultCame: boolean;
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
          if (
            newMessage.results?.length &&
            !newMessage.content &&
            !firstResultCame
          ) {
            setChatOpen(false);
            firstResultCame = true;
          }
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
              error: 'Something went wrong',
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
        className={`fixed z-50 bottom-20 w-13 h-13 rounded-full cursor-pointer flex items-center justify-center ${
          isChatOpen || isRightPanelOpen ? '-right-full' : 'right-8'
        } border border-gray-700 bg-[linear-gradient(135deg,#1D1D20_0%,#0B0B14_100%)] transition-all duration-300 ease-out-slow`}
        onClick={() => {
          setShowTooltip(false);
          setChatOpen(true);
        }}
      >
        {showTooltip && (
          <div className="absolute -top-full right-0 drop-shadow-sm">
            <div className="bg-primary-300 rounded-full flex py-2 px-4 w-max body-s text-white">
              {tooltipText}
            </div>
            <svg
              width="33"
              height="12"
              viewBox="0 0 33 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute -bottom-2 right-6"
            >
              <path
                d="M0 3V0H33V3C23.4444 3.93779 23.1642 8.18145 23.8084 11.5958C23.8623 11.8815 23.5209 12.0844 23.2996 11.8957C16.2381 5.87225 10.3185 3 0 3Z"
                fill="#5D75FF"
              />
            </svg>
          </div>
        )}
        <div className="absolute rounded-full top-0 left-0 right-0 bottom-0 bg-[url('/stars.png')] flex z-0 overflow-hidden">
          <div className="w-full h-full bg-[radial-gradient(47.73%_47.73%_at_50%_0%,transparent_0%,#0B0B14_100%)] animate-spin-extra-slow" />
        </div>
        <div
          className={`w-6 h-6 relative z-10 ${
            isLoading ? 'animate-spin-extra-slow' : ''
          }`}
        >
          {isLoading ? <LiteLoader raw /> : <Sparkle raw />}
        </div>
      </button>
      <div
        ref={chatRef}
        className={`fixed z-50 bottom-20 rounded-xl group w-97 max-h-[30rem] flex flex-col justify-end ${
          !isChatOpen || isRightPanelOpen ? '-right-full' : 'right-8'
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
                <ChipButton variant="filled" onClick={() => setChatOpen(false)}>
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
              isStoppable={isLoading}
              loadingSteps={
                (conversation[conversation.length - 1] as ChatMessageServer)
                  ?.loadingSteps
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
        setActive={setChatOpen}
      />
    </>
  );
};

export default Chat;
