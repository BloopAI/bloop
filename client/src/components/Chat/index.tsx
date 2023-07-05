import React, {
  FormEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import { List } from '../../icons';
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
import { SearchContext } from '../../context/searchContext';
import { mapLoadingSteps } from '../../mappers/conversation';
import { findElementInCurrentTab } from '../../utils/domUtils';
import NLInput from './NLInput';
import ChipButton from './ChipButton';
import AllConversations from './AllCoversations';
import Conversation from './Conversation';
import DeprecatedClientModal from './DeprecatedClientModal';

let prevEventSource: EventSource | undefined;

const focusInput = () => {
  findElementInCurrentTab('#question-input')?.focus();
};

const blurInput = () => {
  findElementInCurrentTab('#question-input')?.blur();
};

const Chat = () => {
  const { isRightPanelOpen, setRightPanelOpen, tab } = useContext(UIContext);
  const { apiUrl } = useContext(DeviceContext);
  const { selectedBranch } = useContext(SearchContext);
  const {
    conversation,
    setConversation,
    isChatOpen,
    setChatOpen,
    setShowTooltip,
    submittedQuery,
    setSubmittedQuery,
    selectedLines,
    setSelectedLines,
    threadId,
    setThreadId,
    queryId,
    setQueryId,
  } = useContext(ChatContext);
  const {
    navigateConversationResults,
    navigateRepoPath,
    navigatedItem,
    navigateArticleResponse,
  } = useContext(AppNavigationContext);
  const [isLoading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const chatRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
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
      console.log('query', query);
      prevEventSource?.close();
      setInputValue('');
      setLoading(true);
      const eventSource = new EventSource(
        `${apiUrl.replace('https:', '')}/answer?q=${encodeURIComponent(query)}${
          selectedBranch ? ` branch:${selectedBranch}` : ''
        }&repo_ref=${tab.key}${threadId ? `&thread_id=${threadId}` : ''}${
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
      let conclusionCame: boolean;
      let i = -1;
      eventSource.onerror = (err) => {
        console.log('SSE error', err);
        firstResultCame = false;
        i = -1;
        stopGenerating();
        setConversation((prev) => {
          const newConversation = prev.slice(0, -1);
          const lastMessage: ChatMessage = {
            author: ChatMessageAuthor.Server,
            isLoading: false,
            type: ChatMessageType.Answer,
            error: 'Something went wrong',
            loadingSteps: [],
          };
          return [...newConversation, lastMessage];
        });
      };
      eventSource.onmessage = (ev) => {
        console.log(ev.data);
        if (
          ev.data === '{"Err":"incompatible client"}' ||
          ev.data === '{"Err":"failed to check compatibility"}'
        ) {
          eventSource.close();
          prevEventSource?.close();
          if (ev.data === '{"Err":"incompatible client"}') {
            setShowPopup(true);
          } else {
            setConversation((prev) => {
              const newConversation = prev.slice(0, -1);
              const lastMessage: ChatMessage = {
                author: ChatMessageAuthor.Server,
                isLoading: false,
                type: ChatMessageType.Answer,
                error: 'Something went wrong',
                loadingSteps: [],
              };
              return [...newConversation, lastMessage];
            });
          }
          setLoading(false);
          return;
        }
        i++;
        if (i === 0) {
          const data = JSON.parse(ev.data);
          setThreadId(data.thread_id);
          setQueryId(data.query_id);
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
            const newMessage = data.Ok;
            if (
              ((newMessage.results?.Filesystem?.length &&
                !newMessage.conclusion) ||
                newMessage.results?.Article?.length) &&
              !firstResultCame
            ) {
              setConversation((prev) => {
                if (newMessage.mode === 'article') {
                  setChatOpen(false);
                  navigateArticleResponse(prev.length - 1, threadId);
                } else {
                  navigateConversationResults(prev.length - 1, threadId);
                }
                return prev;
              });
              firstResultCame = true;
            }
            if (newMessage.conclusion && !conclusionCame) {
              setChatOpen(true);
              conclusionCame = true;
            }
            setConversation((prev) => {
              const newConversation = prev?.slice(0, -1) || [];
              const lastMessage = prev?.slice(-1)[0];
              const messageToAdd = {
                author: ChatMessageAuthor.Server,
                isLoading: !newMessage.finished,
                type: ChatMessageType.Answer,
                loadingSteps: mapLoadingSteps(newMessage.search_steps),
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
                error:
                  data.Err === 'request failed 5 times'
                    ? 'Failed to get a response from OpenAI. Try again in a few moments.'
                    : 'Something went wrong',
              };
              return [...newConversation, lastMessage];
            });
          }
        } catch (err) {
          console.log('failed to parse response', err);
        }
      };
      return () => {
        eventSource.close();
      };
    },
    [
      tab,
      threadId,
      navigatedItem?.path,
      navigatedItem?.type,
      selectedLines,
      selectedBranch,
    ],
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
      setSubmittedQuery(
        submittedQuery === inputValue ? `${inputValue} ` : inputValue, // to trigger new search if query hasn't changed
      );
    },
    [inputValue, conversation, submittedQuery],
  );

  const handleNewConversation = useCallback(() => {
    stopGenerating();
    setConversation([]);
    setLoading(false);
    setThreadId('');
    setSubmittedQuery('');
    setSelectedLines(null);
    if (
      navigatedItem?.type === 'conversation-result' ||
      navigatedItem?.type === 'article-response'
    ) {
      navigateRepoPath(tab.repoName);
    }
    focusInput();
  }, [navigatedItem?.type]);

  return (
    <>
      <div
        ref={chatRef}
        className={`fixed z-50 bottom-20 rounded-xl group w-97 max-h-[30rem] flex flex-col justify-end ${
          isRightPanelOpen ? '-right-full' : 'right-8'
        } backdrop-blur-6 shadow-float bg-chat-bg-base/75 border border-chat-bg-border transition-all duration-300 ease-out-slow`}
        onClick={() => {
          setShowTooltip(false);
          setChatOpen(true);
        }}
      >
        <div className="w-full">
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
                <ChipButton onClick={handleNewConversation}>
                  Create new
                </ChipButton>
                <ChipButton
                  variant="filled"
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatOpen((prev) => !prev);
                  }}
                >
                  {isChatOpen ? 'Hide' : 'Show'}
                </ChipButton>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 overflow-auto">
          {!!conversation.length && isChatOpen && (
            <Conversation
              conversation={conversation}
              threadId={threadId}
              queryId={queryId}
              repoRef={tab.key}
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
                conversation[conversation.length - 1]?.author ===
                ChatMessageAuthor.Server
                  ? [
                      ...(
                        conversation[
                          conversation.length - 1
                        ] as ChatMessageServer
                      ).loadingSteps,
                      ...((
                        conversation[
                          conversation.length - 1
                        ] as ChatMessageServer
                      )?.results?.Article?.length
                        ? [
                            {
                              displayText: 'Responding...',
                              content: '',
                              type: '',
                            },
                          ]
                        : []),
                    ]
                  : undefined
              }
              generationInProgress={
                (conversation[conversation.length - 1] as ChatMessageServer)
                  ?.isLoading
              }
              onStop={stopGenerating}
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
        repoRef={tab.key}
        handleNewConversation={handleNewConversation}
      />
      <DeprecatedClientModal
        isOpen={showPopup}
        onClose={() => setShowPopup(false)}
      />
    </>
  );
};

export default Chat;
