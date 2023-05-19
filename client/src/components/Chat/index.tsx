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
    submittedQuery,
    setSubmittedQuery,
    selectedLines,
    setSelectedLines,
  } = useContext(ChatContext);
  const { navigateConversationResults, navigateRepoPath, navigatedItem } =
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
      if (!query) {
        return;
      }
      prevEventSource?.close();
      setInputValue('');
      setLoading(true);
      const eventSource = new EventSource(
        `${apiUrl.replace('https:', '')}/answer?q=${query}&repo_ref=${tab.key}${
          threadId ? `&thread_id=${threadId}` : ''
        }${
          navigatedItem?.type === 'repo' && navigatedItem?.path
            ? `&relative_path=${navigatedItem?.path}&is_folder=true`
            : ''
        }${
          navigatedItem?.type === 'full-result' && navigatedItem?.path
            ? `&relative_path=${navigatedItem?.path}&is_folder=false`
            : ''
        }${
          selectedLines
            ? `&start=${selectedLines[0]}&end=${selectedLines[1]}`
            : ''
        }`,
      );
      prevEventSource = eventSource;
      setSelectedLines(null);
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
                  (s: { type: string; content: string }) =>
                    s.type === 'PROC'
                      ? `Reading ${
                          s.content.length > 20 ? '...' : ''
                        }${s.content.slice(-20)}`
                      : s.content,
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
    [tab, threadId, navigatedItem?.path, navigatedItem?.type, selectedLines],
  );

  useEffect(() => {
    if (!submittedQuery) {
      return;
    }
    let userQuery = submittedQuery;
    if (submittedQuery.startsWith('#explain_')) {
      const [prefix, ending] = submittedQuery.split(':');
      const [lineStart, lineEnd] = ending.split('-');
      const filePath = prefix.slice(9);
      userQuery = `Explain lines ${Number(lineStart) + 1} - ${
        Number(lineEnd) + 1
      } in ${filePath}`;
    }
    setConversation((prev) => [
      ...prev,
      {
        author: ChatMessageAuthor.User,
        text: userQuery,
        isLoading: false,
      },
    ]);
    makeSearch(userQuery);
  }, [submittedQuery]);

  const stopGenerating = useCallback(() => {
    prevEventSource?.close();
    setLoading(false);
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
      setSubmittedQuery(inputValue);
    },
    [inputValue, conversation],
  );

  return (
    <>
      <button
        className={`fixed z-50 bottom-20 w-16 h-16 rounded-full cursor-pointer flex items-center justify-center ${
          isChatOpen || isRightPanelOpen ? '-right-full' : 'right-8'
        } border border-chat-bg-border bg-chat-bg-base transition-all duration-300 ease-out-slow`}
        onClick={() => {
          setShowTooltip(false);
          setChatOpen(true);
        }}
      >
        {showTooltip && (
          <div className="absolute -top-8 z-10 right-2.5 drop-shadow-sm">
            <div className="bg-chat-bg-base border border-chat-bg-border rounded-4 flex py-2 px-4 w-max body-s text-label-title">
              {tooltipText}
            </div>
            <span className="absolute right-[2.375rem] -bottom-px w-3.5 h-0.5 bg-chat-bg-base z-10" />
            <svg
              width="97"
              height="14"
              viewBox="0 0 97 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute -bottom-2 right-0 -z-10"
            >
              <path
                d="M31.5 4V4.5H32C37.1106 4.5 41.1041 5.2109 44.6844 6.65285C48.2676 8.09598 51.4662 10.283 54.9751 13.2761C55.5683 13.7821 56.438 13.2356 56.2997 12.5031C55.9833 10.8263 55.9276 9.09472 56.9816 7.66601C58.0394 6.2322 60.3211 4.96159 65.0488 4.49761L65.5 4.45333V4V1V0.5H65H32H31.5V1V4Z"
                className="fill-chat-bg-base stroke-chat-bg-border"
              />
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
                    setSubmittedQuery('');
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
              selectedLines={selectedLines}
              setSelectedLines={setSelectedLines}
            />
          </form>
        </div>
      </div>
      <AllConversations
        setHistoryOpen={setRightPanelOpen}
        isHistoryOpen={isRightPanelOpen}
        setActive={setChatOpen}
        setConversation={setConversation}
        setThreadId={setThreadId}
      />
    </>
  );
};

export default Chat;
