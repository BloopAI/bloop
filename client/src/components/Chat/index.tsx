import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
  OpenChatHistoryItem,
} from '../../types/general';
import { AppNavigationContext } from '../../context/appNavigationContext';
import { ChatContext } from '../../context/chatContext';
import { SearchContext } from '../../context/searchContext';
import { mapLoadingSteps } from '../../mappers/conversation';
import { findElementInCurrentTab } from '../../utils/domUtils';
import { conversationsCache } from '../../services/cache';
import DeprecatedClientModal from './DeprecatedClientModal';
import ChatHeader from './ChatHeader';
import ChatBody from './ChatBody';
import ChatFooter from './ChatFooter';

let prevEventSource: EventSource | undefined;

const focusInput = () => {
  findElementInCurrentTab('#question-input')?.focus();
};

const Chat = () => {
  const { t } = useTranslation();
  const { tab } = useContext(UIContext.Tab);
  const { apiUrl } = useContext(DeviceContext);
  const { selectedBranch } = useContext(SearchContext.SelectedBranch);
  const { conversation, submittedQuery, threadId } = useContext(
    ChatContext.Values,
  );
  const { setThreadId, setSelectedLines, setSubmittedQuery, setConversation } =
    useContext(ChatContext.Setters);
  const { navigateRepoPath, navigatedItem, navigateFullResult } =
    useContext(AppNavigationContext);
  const [isLoading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [isHistoryTab, setIsHistoryTab] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [queryIdToEdit, setQueryIdToEdit] = useState('');
  const [hideMessagesFrom, setHideMessagesFrom] = useState<null | number>(null);
  const [openHistoryItem, setOpenHistoryItem] =
    useState<OpenChatHistoryItem | null>(null);
  const chatRef = useRef(null);

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
            conversationsCache[thread_id] = undefined; // clear cache on new answer
            setConversation((prev) => {
              const newConversation = prev?.slice(0, -1) || [];
              const lastMessage = prev?.slice(-1)[0];
              const messageToAdd = {
                author: ChatMessageAuthor.Server,
                isLoading: true,
                loadingSteps: mapLoadingSteps(newMessage.search_steps, t),
                text: newMessage.answer,
                conclusion: newMessage.conclusion,
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
                  navigateFullResult(
                    newMessage.focused_chunk?.file_path,
                    undefined,
                    prev.length - 1,
                    thread_id,
                  );
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
    <div
      ref={chatRef}
      className={`group w-99 flex flex-col bg-chat-bg-sub border-l border-chat-bg-border relative`}
    >
      <ChatHeader
        setIsHistoryTab={setIsHistoryTab}
        isHistoryTab={isHistoryTab}
        isLoading={isLoading}
        conversationName={conversation?.[0]?.text}
        handleNewConversation={handleNewConversation}
        openHistoryItem={openHistoryItem}
        setOpenHistoryItem={setOpenHistoryItem}
      />
      <ChatBody
        isLoading={isLoading}
        repoName={tab.repoName}
        onMessageEdit={onMessageEdit}
        isHistoryTab={isHistoryTab}
        hideMessagesFrom={hideMessagesFrom}
        repoRef={tab.repoRef}
        queryIdToEdit={queryIdToEdit}
        tabName={tab.name}
        openHistoryItem={openHistoryItem}
        setOpenHistoryItem={setOpenHistoryItem}
      />
      <ChatFooter
        isLoading={isLoading}
        queryIdToEdit={queryIdToEdit}
        onMessageEditCancel={onMessageEditCancel}
        hideMessagesFrom={hideMessagesFrom}
        setInputValue={setInputValue}
        inputValue={inputValue}
        stopGenerating={stopGenerating}
        openHistoryItem={openHistoryItem}
        isHistoryOpen={isHistoryTab}
        setHistoryOpen={setIsHistoryTab}
      />
      <DeprecatedClientModal
        isOpen={showPopup}
        onClose={() => setShowPopup(false)}
      />
    </div>
  );
};

export default Chat;
