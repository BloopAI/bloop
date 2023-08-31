import React, {
  FormEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import { Info, List } from '../../icons';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
} from '../../types/general';
import { AppNavigationContext } from '../../context/appNavigationContext';
import { ChatContext } from '../../context/chatContext';
import { SearchContext } from '../../context/searchContext';
import { mapLoadingSteps } from '../../mappers/conversation';
import { findElementInCurrentTab } from '../../utils/domUtils';
import { conversationsCache } from '../../services/cache';
import AddStudioContext from '../AddStudioContext';
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
  const { t } = useTranslation();
  const { isRightPanelOpen, setRightPanelOpen } = useContext(
    UIContext.RightPanel,
  );
  const { tab } = useContext(UIContext.Tab);
  const { apiUrl } = useContext(DeviceContext);
  const { selectedBranch } = useContext(SearchContext.SelectedBranch);
  const { conversation, isChatOpen, submittedQuery, selectedLines, threadId } =
    useContext(ChatContext.Values);
  const {
    setThreadId,
    setSelectedLines,
    setSubmittedQuery,
    setConversation,
    setChatOpen,
    setShowTooltip,
  } = useContext(ChatContext.Setters);
  const {
    navigateRepoPath,
    navigatedItem,
    navigateArticleResponse,
    navigateFullResult,
  } = useContext(AppNavigationContext);
  const [isLoading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const chatRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [queryIdToEdit, setQueryIdToEdit] = useState('');
  const [hideMessagesFrom, setHideMessagesFrom] = useState<null | number>(null);
  useOnClickOutside(chatRef, () => setChatOpen(false));

  useEffect(() => {
    if (isChatOpen) {
      focusInput();
    }
  }, [isChatOpen]);

  const makeSearch = useCallback(
    (
      query: string,
      options?: { filePath: string; lineStart: string; lineEnd: string },
    ) => {
      if (!query) {
        return;
      }
      console.log('query', query);
      prevEventSource?.close();
      setInputValue('');
      setLoading(true);
      setQueryIdToEdit('');
      setHideMessagesFrom(null);
      const url = `${apiUrl}/answer${
        options
          ? `/explain?relative_path=${encodeURIComponent(
              options.filePath,
            )}&line_start=${options.lineStart}&line_end=${options.lineEnd}`
          : `?q=${encodeURIComponent(query)}${
              selectedBranch ? ` branch:${selectedBranch}` : ''
            }`
      }&repo_ref=${tab.repoRef}${
        threadId
          ? `&thread_id=${threadId}${
              queryIdToEdit ? `&parent_query_id=${queryIdToEdit}` : ''
            }`
          : ''
      }`;
      console.log(url);
      const eventSource = new EventSource(url);
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
            error: t(
              "We couldn't answer your question. You can try asking again in a few moments, or rephrasing your question.",
            ),
            loadingSteps: [],
            queryId: '',
            responseTimestamp: new Date().toISOString(),
          };
          if (!options) {
            setInputValue(prev[prev.length - 2]?.text || submittedQuery);
          }
          setSubmittedQuery('');
          return [...newConversation, lastMessage];
        });
      };
      let thread_id = '';
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
                error: t(
                  "We couldn't answer your question. You can try asking again in a few moments, or rephrasing your question.",
                ),
                loadingSteps: [],
                queryId: '',
                responseTimestamp: new Date().toISOString(),
              };
              if (!options) {
                setInputValue(prev[prev.length - 1]?.text || submittedQuery);
              }
              setSubmittedQuery('');
              return [...newConversation, lastMessage];
            });
          }
          setLoading(false);
          return;
        }
        i++;
        if (i === 0) {
          const data = JSON.parse(ev.data);
          thread_id = data.thread_id;
          setThreadId(data.thread_id);
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
            if (newMessage.conclusion && !conclusionCame) {
              setChatOpen(true);
              conclusionCame = true;
            }
            conversationsCache[thread_id] = undefined; // clear cache on new answer
            setConversation((prev) => {
              const newConversation = prev?.slice(0, -1) || [];
              const lastMessage = prev?.slice(-1)[0];
              const messageToAdd = {
                author: ChatMessageAuthor.Server,
                isLoading: true,
                loadingSteps: mapLoadingSteps(newMessage.search_steps, t),
                text: newMessage.conclusion,
                results: newMessage.answer,
                queryId: newMessage.id,
                responseTimestamp: newMessage.response_timestamp,
                explainedFile: newMessage.focused_chunk?.file_path,
              };
              const lastMessages: ChatMessage[] =
                lastMessage?.author === ChatMessageAuthor.Server
                  ? [messageToAdd]
                  : [...prev.slice(-1), messageToAdd];
              return [...newConversation, ...lastMessages];
            });
            // workaround: sometimes we get [^summary]: before it is removed from response
            if (newMessage.answer?.length > 11 && !firstResultCame) {
              setConversation((prev) => {
                if (newMessage.focused_chunk?.file_path) {
                  setChatOpen(false);
                  navigateFullResult(
                    newMessage.focused_chunk?.file_path,
                    undefined,
                    prev.length - 1,
                    thread_id,
                  );
                } else {
                  setChatOpen(false);
                  navigateArticleResponse(prev.length - 1, thread_id);
                }
                return prev;
              });
              firstResultCame = true;
            }
          } else if (data.Err) {
            setConversation((prev) => {
              const lastMessageIsServer =
                prev[prev.length - 1].author === ChatMessageAuthor.Server;
              const newConversation = prev.slice(
                0,
                lastMessageIsServer ? -2 : -1,
              );
              const lastMessage: ChatMessageServer = {
                ...(lastMessageIsServer
                  ? (prev.slice(-1)[0] as ChatMessageServer)
                  : {
                      author: ChatMessageAuthor.Server,
                      loadingSteps: [],
                      queryId: '',
                      responseTimestamp: new Date().toISOString(),
                    }),
                isLoading: false,
                error:
                  data.Err === 'request failed 5 times'
                    ? t(
                        'Failed to get a response from OpenAI. Try again in a few moments.',
                      )
                    : t(
                        "We couldn't answer your question. You can try asking again in a few moments, or rephrasing your question.",
                      ),
              };
              if (!options) {
                setInputValue(
                  prev[prev.length - (lastMessageIsServer ? 2 : 1)]?.text ||
                    submittedQuery,
                );
              }
              setSubmittedQuery('');
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
      selectedBranch,
      t,
      queryIdToEdit,
    ],
  );

  useEffect(() => {
    if (!submittedQuery) {
      return;
    }
    let userQuery = submittedQuery;
    let options = undefined;
    if (submittedQuery.startsWith('#explain_')) {
      const [prefix, ending] = submittedQuery.split(':');
      const [lineStart, lineEnd] = ending.split('-');
      const filePath = prefix.slice(9);
      options = {
        filePath,
        lineStart,
        lineEnd,
      };
      userQuery = t(
        `Explain the purpose of the file {{filePath}}, from lines {{lineStart}} - {{lineEnd}}`,
        {
          lineStart: Number(lineStart) + 1,
          lineEnd: Number(lineEnd) + 1,
          filePath,
        },
      );
    }
    setConversation((prev) => [
      ...prev,
      {
        author: ChatMessageAuthor.User,
        text: userQuery,
        isLoading: false,
      },
    ]);
    makeSearch(userQuery, options);
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
      if (hideMessagesFrom !== null) {
        setConversation((prev) => prev.slice(0, hideMessagesFrom));
      }
      blurInput();
      setSubmittedQuery(
        submittedQuery === inputValue ? `${inputValue} ` : inputValue, // to trigger new search if query hasn't changed
      );
    },
    [inputValue, conversation, submittedQuery, hideMessagesFrom],
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

  const onMessageEdit = useCallback(
    (parentQueryId: string, i: number) => {
      setQueryIdToEdit(parentQueryId);
      if (isLoading) {
        stopGenerating();
      }
      setHideMessagesFrom(i);
      setInputValue(conversation[i].text!);
    },
    [isLoading, conversation],
  );

  const onMessageEditCancel = useCallback(() => {
    setQueryIdToEdit('');
    setInputValue('');
    setHideMessagesFrom(null);
  }, []);

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
                <List /> <Trans>All conversations</Trans>
              </ChipButton>
              <div className="flex items-center gap-1">
                <ChipButton onClick={handleNewConversation}>
                  <Trans>Create new</Trans>
                </ChipButton>
                {!!threadId && !isLoading && (
                  <AddStudioContext
                    threadId={threadId}
                    name={conversation?.[0]?.text || 'New Studio'}
                  />
                )}
                <ChipButton
                  variant="filled"
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatOpen((prev) => !prev);
                  }}
                >
                  <Trans>{isChatOpen ? 'Hide' : 'Show'}</Trans>
                </ChipButton>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 overflow-auto">
          {!!conversation.length && isChatOpen && (
            <Conversation
              conversation={
                hideMessagesFrom === null
                  ? conversation
                  : conversation.slice(0, hideMessagesFrom + 1)
              }
              threadId={threadId}
              repoRef={tab.repoRef}
              isLoading={isLoading}
              repoName={tab.repoName}
              onMessageEdit={onMessageEdit}
            />
          )}
          {!!queryIdToEdit && (
            <div className="mx-4 mb-3 flex gap-1.5 caption text-label-base select-none">
              <Info raw sizeClassName="w-3.5 h-3.5" />
              <p>
                <Trans>
                  Editing a previously submitted question will discard all
                  answers and questions following it.
                </Trans>
              </p>
            </div>
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
                      )?.results?.length
                        ? [
                            {
                              displayText: t('Responding...'),
                              content: { query: '' },
                              path: '',
                              type: 'code' as const,
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
              queryIdToEdit={queryIdToEdit}
              onMessageEditCancel={onMessageEditCancel}
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
        repoRef={tab.repoRef}
        repoName={tab.repoName}
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
