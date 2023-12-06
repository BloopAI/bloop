import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DeviceContext } from '../../../context/deviceContext';
import { ProjectContext } from '../../../context/projectContext';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
  ChatMessageUser,
  InputValueType,
  ParsedQueryType,
  ParsedQueryTypeEnum,
} from '../../../types/general';
import { conversationsCache } from '../../../services/cache';
import { mapLoadingSteps } from '../../../mappers/conversation';
import { focusInput } from '../../../utils/domUtils';
import { ChatsContext } from '../../../context/chatsContext';

type Props = {
  tabKey: string;
};

const ChatPersistentState = ({ tabKey }: Props) => {
  const { t } = useTranslation();
  const { apiUrl } = useContext(DeviceContext);
  const { project } = useContext(ProjectContext.Current);
  const { setChats } = useContext(ChatsContext);

  const [queryId, setQueryId] = useState('');

  const prevEventSource = useRef<EventSource | null>(null);

  useEffect(() => {
    setTimeout(focusInput, 500);
  }, []);

  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], conversation } };
    });
  }, [conversation]);

  const [selectedLines, setSelectedLines] = useState<[number, number] | null>(
    null,
  );
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], selectedLines } };
    });
  }, [selectedLines]);

  const [inputValue, setInputValue] = useState<InputValueType>({
    plain: '',
    parsed: [],
  });
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], inputValue } };
    });
  }, [inputValue]);

  const [submittedQuery, setSubmittedQuery] = useState<InputValueType>({
    parsed: [],
    plain: '',
  });
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], submittedQuery } };
    });
  }, [submittedQuery]);

  const [isLoading, setLoading] = useState(false);
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], isLoading } };
    });
  }, [isLoading]);

  const [hideMessagesFrom, setHideMessagesFrom] = useState<null | number>(null);
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], hideMessagesFrom } };
    });
  }, [hideMessagesFrom]);

  const [queryIdToEdit, setQueryIdToEdit] = useState('');
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], queryIdToEdit } };
    });
  }, [queryIdToEdit]);

  const [inputImperativeValue, setInputImperativeValue] = useState<Record<
    string,
    any
  > | null>(null);
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], inputImperativeValue } };
    });
  }, [inputImperativeValue]);

  const [threadId, setThreadId] = useState('');
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], threadId } };
    });
  }, [threadId]);

  useEffect(() => {
    setChats((prev) => {
      return {
        ...prev,
        [tabKey]: {
          ...prev[tabKey],
          setConversation,
          setInputValue,
          setSelectedLines,
          setSubmittedQuery,
          setThreadId,
        },
      };
    });
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
  useEffect(() => {
    setChats((prev) => {
      return {
        ...prev,
        [tabKey]: { ...prev[tabKey], setInputValueImperatively },
      };
    });
  }, [setInputValueImperatively]);

  const makeSearch = useCallback(
    (
      query: string,
      options?: { filePath: string; lineStart: string; lineEnd: string },
    ) => {
      if (!query) {
        return;
      }
      prevEventSource.current?.close();
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
      prevEventSource.current = eventSource;
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
          prevEventSource.current?.close();
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
          prevEventSource.current = null;
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
    prevEventSource.current?.close();
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
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], stopGenerating } };
    });
  }, [stopGenerating]);

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
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], onMessageEdit } };
    });
  }, [onMessageEdit]);

  const onMessageEditCancel = useCallback(() => {
    setQueryIdToEdit('');
    setInputValue({ plain: '', parsed: [] });
    setInputImperativeValue(null);
    setHideMessagesFrom(null);
  }, []);
  useEffect(() => {
    setChats((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], onMessageEditCancel } };
    });
  }, [onMessageEditCancel]);

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

  return null;
};

export default memo(ChatPersistentState);
