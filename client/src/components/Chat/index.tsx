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
      let firstResultCame: boolean;
      let i = -1;
      eventSource.onerror = (err) => {
        console.log(err);
        firstResultCame = false;
        i = -1;
      };
      eventSource.onmessage = (ev) => {
        console.log(ev.data);
        i++;
        if (i === 0) {
          setThreadId(ev.data);
          return;
        }
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
        try {
          const data = JSON.parse(ev.data);
          if (data.Ok) {
            setResp(data.Ok);
            const newMessage = data.Ok;
            if (
              newMessage.results?.length &&
              !newMessage.conclusion &&
              !firstResultCame
            ) {
              setChatOpen(false);
              setConversation((prev) => {
                navigateConversationResults(prev.length - 1, threadId);
                return prev;
              });
              firstResultCame = true;
            }
            setConversation((prev) => {
              const newConversation = prev?.slice(0, -1) || [];
              const lastMessage = prev?.slice(-1)[0];
              const messageToAdd = {
                author: ChatMessageAuthor.Server,
                isLoading: !newMessage.finished,
                type: ChatMessageType.Answer,
                loadingSteps: newMessage.search_steps.map(
                  (s: { type: string; content: string }) => s.content,
                ),
                text: newMessage.conclusion,
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
        } catch (err) {
          console.log(err);
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
        className={`fixed z-50 bottom-20 w-16 h-16 rounded-full cursor-pointer flex items-center justify-center ${
          isChatOpen || isRightPanelOpen ? '-right-full' : 'right-8'
        } border border-chat-bg-border bg-[linear-gradient(135deg,#1D1D20_0%,#0B0B14_100%)] transition-all duration-300 ease-out-slow`}
        onClick={() => {
          setShowTooltip(false);
          setChatOpen(true);
        }}
      >
        {showTooltip && (
          <div className="absolute -top-8 z-10 right-2.5 drop-shadow-sm">
            <div className="bg-[linear-gradient(93.53deg,#5D75FF_0%,#2A2A4A_100%)] rounded-full flex py-2 px-4 w-max body-s text-label-title">
              {tooltipText}
            </div>
            <svg
              width="97"
              height="13"
              viewBox="0 0 97 13"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute -bottom-2 right-0 -z-10"
            >
              <path
                d="M32 3V0H65V3C55.4444 3.93779 55.1642 8.18145 55.8084 11.5958C55.8623 11.8815 55.5209 12.0844 55.2996 11.8957C48.2381 5.87225 42.3185 3 32 3Z"
                fill="url(#paint0_linear_8526_247744)"
              />
              <defs>
                <linearGradient
                  id="paint0_linear_8526_247744"
                  x1="38.5"
                  y1="2"
                  x2="56"
                  y2="12.5"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#3C4488" />
                  <stop offset="1" stopColor="#35396D" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )}
        <div className="absolute rounded-full top-0 left-0 right-0 bottom-0 bg-[url('/stars.png')] bg-cover flex z-0 overflow-hidden">
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
        } backdrop-blur-6 shadow-low bg-chat-bg-base/50 border border-chat-bg-border transition-all duration-300 ease-out-slow`}
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
                    stopGenerating();
                    setConversation([]);
                    setLoading(false);
                    setThreadId('');
                    navigateRepoPath(tab.repoName);
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
              setHistoryOpen={setRightPanelOpen}
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
