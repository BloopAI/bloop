import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import ScrollToBottom from 'react-scroll-to-bottom';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
  ChatMessageUser,
  ParsedQueryType,
  ParsedQueryTypeEnum,
} from '../../../types/general';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import { DeviceContext } from '../../../context/deviceContext';
import { ProjectContext } from '../../../context/projectContext';
import { conversationsCache } from '../../../services/cache';
import { mapLoadingSteps } from '../../../mappers/conversation';
import { WarningSignIcon } from '../../../icons';
import StarterMessage from './StarterMessage';
import Input from './Input';
import Message from './Message';

type Props = {
  side: 'left' | 'right';
};

let prevEventSource: EventSource | undefined;

const focusInput = () => {
  findElementInCurrentTab('.ProseMirror')?.focus();
};

const Conversation = ({ side }: Props) => {
  const { t } = useTranslation();
  const { apiUrl } = useContext(DeviceContext);
  const { project } = useContext(ProjectContext.Current);

  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState<{
    parsed: ParsedQueryType[];
    plain: string;
  }>({
    parsed: [],
    plain: '',
  });
  const [selectedLines, setSelectedLines] = useState<[number, number] | null>(
    null,
  );
  const [threadId, setThreadId] = useState('');
  const [queryId, setQueryId] = useState('');
  const [inputValue, setInputValue] = useState<{
    parsed: ParsedQueryType[];
    plain: string;
  }>({ plain: '', parsed: [] });
  const [isLoading, setLoading] = useState(false);
  const [queryIdToEdit, setQueryIdToEdit] = useState('');
  const [inputImperativeValue, setInputImperativeValue] = useState<Record<
    string,
    any
  > | null>(null);
  const [hideMessagesFrom, setHideMessagesFrom] = useState<null | number>(null);

  useEffect(() => {
    setTimeout(focusInput, 500);
  }, []);

  const setInputValueImperatively = useCallback(
    (value: ParsedQueryType[] | string) => {
      setInputImperativeValue({
        type: 'paragraph',
        content:
          typeof value === 'string'
            ? [
                {
                  type: 'text',
                  text: value,
                },
              ]
            : value
                .filter((pq) => ['path', 'lang', 'text'].includes(pq.type))
                .map((pq) =>
                  pq.type === 'text'
                    ? { type: 'text', text: pq.text }
                    : {
                        type: 'mention',
                        attrs: {
                          id: pq.text,
                          display: pq.text,
                          type: pq.type,
                          isFirst: false,
                        },
                      },
                ),
      });
    },
    [],
  );

  const makeSearch = useCallback(
    (
      query: string,
      options?: { filePath: string; lineStart: string; lineEnd: string },
    ) => {
      if (!query) {
        return;
      }
      prevEventSource?.close();
      setInputValue({ plain: '', parsed: [] });
      setInputImperativeValue(null);
      setLoading(true);
      setQueryIdToEdit('');
      setHideMessagesFrom(null);
      const url = `${apiUrl}/projects/${project?.id}/answer${
        options
          ? `/explain?relative_path=${encodeURIComponent(
              options.filePath,
            )}&line_start=${options.lineStart}&line_end=${options.lineEnd}`
          : `?q=${encodeURIComponent(query)}`
      }${
        threadId
          ? `&thread_id=${threadId}${
              queryIdToEdit ? `&parent_query_id=${queryIdToEdit}` : ''
            }`
          : ''
      }&model=gpt-4`;
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
            // setInputValue(prev[prev.length - 2]?.text || submittedQuery);
            setInputValueImperatively(
              (prev[prev.length - 2] as ChatMessageUser)?.parsedQuery ||
                prev[prev.length - 2]?.text ||
                submittedQuery.parsed,
            );
          }
          setSubmittedQuery({ plain: '', parsed: [] });
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
            // setShowPopup(true);
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
                // setInputValue(prev[prev.length - 1]?.text || submittedQuery);
                setInputValueImperatively(
                  (prev[prev.length - 1] as ChatMessageUser)?.parsedQuery ||
                    prev[prev.length - 2]?.text ||
                    submittedQuery.parsed,
                );
              }
              setSubmittedQuery({ plain: '', parsed: [] });
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
          setTimeout(() => focusInput(), 100);
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
                  // navigateFullResult(
                  //   newMessage.focused_chunk?.file_path,
                  //   undefined,
                  //   prev.length - 1,
                  //   thread_id,
                  // );
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
                // setInputValue(
                //   prev[prev.length - (lastMessageIsServer ? 2 : 1)]?.text ||
                //     submittedQuery,
                // );
                setInputValueImperatively(
                  (
                    prev[
                      prev.length - (lastMessageIsServer ? 2 : 1)
                    ] as ChatMessageUser
                  )?.parsedQuery ||
                    prev[prev.length - 2]?.text ||
                    submittedQuery.parsed,
                );
              }
              setSubmittedQuery({ plain: '', parsed: [] });
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
    [threadId, t, queryIdToEdit],
  );

  useEffect(() => {
    if (!submittedQuery.plain) {
      return;
    }
    let userQuery = submittedQuery.plain;
    let userQueryParsed = submittedQuery.parsed;
    let options = undefined;
    if (submittedQuery.plain.startsWith('#explain_')) {
      const [prefix, ending] = submittedQuery.plain.split(':');
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
      userQueryParsed = [{ type: ParsedQueryTypeEnum.TEXT, text: userQuery }];
    }
    setConversation((prev) => [
      ...prev,
      {
        author: ChatMessageAuthor.User,
        text: userQuery,
        parsedQuery: userQueryParsed,
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
    setTimeout(focusInput, 100);
  }, []);

  const onMessageEdit = useCallback(
    (parentQueryId: string, i: number) => {
      setQueryIdToEdit(parentQueryId);
      if (isLoading) {
        stopGenerating();
      }
      setHideMessagesFrom(i);
      const mes = conversation[i] as ChatMessageUser;
      setInputValueImperatively(mes.parsedQuery || mes.text!);
    },
    [isLoading, conversation],
  );

  const onMessageEditCancel = useCallback(() => {
    setQueryIdToEdit('');
    setInputValue({ plain: '', parsed: [] });
    setInputImperativeValue(null);
    setHideMessagesFrom(null);
  }, []);

  const loadingSteps = useMemo(() => {
    return conversation[conversation.length - 1]?.author ===
      ChatMessageAuthor.Server
      ? [
          ...(conversation[conversation.length - 1] as ChatMessageServer)
            .loadingSteps,
          ...((conversation[conversation.length - 1] as ChatMessageServer)?.text
            ?.length
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
      : undefined;
  }, [JSON.stringify(conversation[conversation.length - 1])]);

  return (
    <div className="max-w-2xl mx-auto flex flex-col flex-1 overflow-auto">
      <ScrollToBottom className="max-w-full flex flex-col overflow-auto">
        <StarterMessage
          isEmptyConversation
          setInputValueImperatively={setInputValueImperatively}
        />
        {(hideMessagesFrom === null
          ? conversation
          : conversation.slice(0, hideMessagesFrom + 1)
        ).map((m, i) => (
          <Message
            key={i}
            i={i}
            side={side}
            projectId={project?.id!}
            isLoading={m.author === ChatMessageAuthor.Server && m.isLoading}
            loadingSteps={
              m.author === ChatMessageAuthor.Server ? m.loadingSteps : []
            }
            author={m.author}
            text={m.text || ''}
            parsedQuery={
              m.author === ChatMessageAuthor.Server ? undefined : m.parsedQuery
            }
            error={m.author === ChatMessageAuthor.Server ? m.error : ''}
            showInlineFeedback={
              m.author === ChatMessageAuthor.Server &&
              !m.isLoading &&
              !isLoading &&
              i === conversation.length - 1 &&
              !m.isFromHistory
            }
            threadId={threadId}
            queryId={
              m.author === ChatMessageAuthor.Server
                ? m.queryId
                : (conversation[i - 1] as ChatMessageServer)?.queryId ||
                  '00000000-0000-0000-0000-000000000000'
            }
            onMessageEdit={onMessageEdit}
            responseTimestamp={
              m.author === ChatMessageAuthor.Server ? m.responseTimestamp : null
            }
            singleFileExplanation={
              m.author === ChatMessageAuthor.Server &&
              !!m.explainedFile &&
              // m.explainedFile === navigatedItem?.path
              false
            }
          />
        ))}
        {hideMessagesFrom !== null && (
          <div className="flex items-center w-full p-4 gap-4 select-none">
            <div className="w-7 h-7 flex items-center justify-center rounded-full bg-yellow-subtle text-yellow">
              <WarningSignIcon sizeClassName="w-3.5 h-3.5" />
            </div>
            <p className="text-yellow body-s">
              <Trans>
                Editing previously submitted questions will discard all answers
                and questions following it
              </Trans>
            </p>
          </div>
        )}
      </ScrollToBottom>
      <Input
        selectedLines={selectedLines}
        setSelectedLines={setSelectedLines}
        onStop={stopGenerating}
        submittedQuery={submittedQuery}
        isStoppable={isLoading}
        onMessageEditCancel={onMessageEditCancel}
        generationInProgress={
          (conversation[conversation.length - 1] as ChatMessageServer)
            ?.isLoading
        }
        hideMessagesFrom={hideMessagesFrom}
        queryIdToEdit={queryIdToEdit}
        valueToEdit={inputImperativeValue}
        setInputValue={setInputValue}
        value={inputValue}
        setConversation={setConversation}
        conversation={conversation}
        setSubmittedQuery={setSubmittedQuery}
      />
    </div>
  );
};

export default memo(Conversation);
