import {
  memo,
  useCallback,
  useContext,
  useEffect,
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
  ChatTabType,
  InputValueType,
  ParsedQueryType,
  ParsedQueryTypeEnum,
  TabTypesEnum,
} from '../../../types/general';
import { mapLoadingSteps } from '../../../mappers/conversation';
import { focusInput } from '../../../utils/domUtils';
import { TabsContext } from '../../../context/tabsContext';
import { getCodeStudio } from '../../../services/api';
import { StudiosContext } from '../../../context/studiosContext';

type Options = {
  path: string;
  lines: [number, number];
  repoRef: string;
  branch?: string | null;
};

type Props = {
  tabKey: string;
  tabTitle?: string;
  studioId?: string;
  side: 'left' | 'right';
};

const StudioPersistentState = ({
  tabKey,
  tabTitle,
  side,
  studioId: stId,
}: Props) => {
  const { t } = useTranslation();
  const { apiUrl } = useContext(DeviceContext);
  const { project, refreshCurrentProjectStudios } = useContext(
    ProjectContext.Current,
  );
  const { preferredAnswerSpeed } = useContext(ProjectContext.AnswerSpeed);
  const { setStudios } = useContext(StudiosContext);
  const { openNewTab, updateTabProperty } = useContext(TabsContext.Handlers);

  const eventSource = useRef<EventSource | null>(null);

  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], conversation } };
    });
  }, [conversation]);

  const [inputValue, setInputValue] = useState<InputValueType>({
    plain: '',
    parsed: [],
  });
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], inputValue } };
    });
  }, [inputValue]);

  const [submittedQuery, setSubmittedQuery] = useState<
    InputValueType & { options?: Options }
  >({
    parsed: [],
    plain: '',
  });
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], submittedQuery } };
    });
  }, [submittedQuery]);

  const [isLoading, setLoading] = useState(false);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], isLoading } };
    });
  }, [isLoading]);

  const [isDeprecatedModalOpen, setDeprecatedModalOpen] = useState(false);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], isDeprecatedModalOpen } };
    });
  }, [isDeprecatedModalOpen]);

  const [hideMessagesFrom, setHideMessagesFrom] = useState<null | number>(null);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], hideMessagesFrom } };
    });
  }, [hideMessagesFrom]);

  const [queryIdToEdit, setQueryIdToEdit] = useState('');
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], queryIdToEdit } };
    });
  }, [queryIdToEdit]);

  const [inputImperativeValue, setInputImperativeValue] = useState<Record<
    string,
    any
  > | null>(null);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], inputImperativeValue } };
    });
  }, [inputImperativeValue]);

  const [threadId, setThreadId] = useState('');
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], threadId } };
    });
  }, [threadId]);

  const [conversationId, setConversationId] = useState('');
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], conversationId } };
    });
  }, [conversationId]);

  const closeDeprecatedModal = useCallback(() => {
    setDeprecatedModalOpen(false);
  }, []);

  useEffect(() => {
    setStudios((prev) => {
      return {
        ...prev,
        [tabKey]: {
          ...prev[tabKey],
          setConversation,
          setInputValue,
          setSubmittedQuery,
          setThreadId,
          closeDeprecatedModal,
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
                .filter((pq) =>
                  ['path', 'lang', 'text', 'repo'].includes(pq.type),
                )
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
      focusInput();
    },
    [],
  );
  useEffect(() => {
    setStudios((prev) => {
      return {
        ...prev,
        [tabKey]: { ...prev[tabKey], setInputValueImperatively },
      };
    });
  }, [setInputValueImperatively]);

  const makeSearch = useCallback(
    async (query: string, options?: Options) => {
      if (!query) {
        return;
      }
      eventSource.current?.close();
      setInputValue({ plain: '', parsed: [] });
      setInputImperativeValue(null);
      setLoading(true);
      setQueryIdToEdit('');
      setHideMessagesFrom(null);
      const url = `${apiUrl}/projects/${project?.id}/answer${
        options ? `/explain` : ``
      }`;
      const queryParams: Record<string, string> = {
        model:
          preferredAnswerSpeed === 'normal'
            ? 'gpt-4'
            : 'gpt-3.5-turbo-finetuned',
      };
      if (conversationId) {
        queryParams.conversation_id = conversationId;
        if (queryIdToEdit) {
          queryParams.parent_query_id = queryIdToEdit;
        }
      }
      if (options) {
        queryParams.relative_path = options.path;
        queryParams.repo_ref = options.repoRef;
        if (options.branch) {
          queryParams.branch = options.branch;
        }
        queryParams.line_start = options.lines[0].toString();
        queryParams.line_end = options.lines[1].toString();
      } else {
        queryParams.q = query;
      }
      const fullUrl = url + '?' + new URLSearchParams(queryParams).toString();
      console.log(fullUrl);
      eventSource.current = new EventSource(fullUrl);
      let firstResultCame: boolean;
      eventSource.current.onerror = (err) => {
        console.log('SSE error', err);
        firstResultCame = false;
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
      let conversation_id = '';
      setConversation((prev) =>
        prev[prev.length - 1].author === ChatMessageAuthor.Server &&
        (prev[prev.length - 1] as ChatMessageServer).isLoading
          ? prev
          : [
              ...prev,
              {
                author: ChatMessageAuthor.Server,
                isLoading: true,
                loadingSteps: [],
                text: '',
                conclusion: '',
                queryId: '',
                responseTimestamp: '',
              },
            ],
      );
      eventSource.current.onmessage = (ev) => {
        console.log(ev.data);
        if (
          ev.data === '{"Err":"incompatible client"}' ||
          ev.data === '{"Err":"failed to check compatibility"}'
        ) {
          eventSource.current?.close();
          if (ev.data === '{"Err":"incompatible client"}') {
            setDeprecatedModalOpen(true);
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
        try {
          const data = JSON.parse(ev.data);
          if (data?.Ok?.ChatEvent) {
            const newMessage = data.Ok.ChatEvent;
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
                explainedFile: newMessage.focused_chunk?.repo_path,
              };
              const lastMessages: ChatMessage[] =
                lastMessage?.author === ChatMessageAuthor.Server
                  ? [messageToAdd]
                  : [...prev.slice(-1), messageToAdd];
              return [...newConversation, ...lastMessages];
            });
            // workaround: sometimes we get [^summary]: before it is removed from response
            if (newMessage.answer?.length > 11 && !firstResultCame) {
              if (newMessage.focused_chunk?.repo_path) {
                openNewTab(
                  {
                    type: TabTypesEnum.FILE,
                    path: newMessage.focused_chunk.repo_path.path,
                    repoRef: newMessage.focused_chunk.repo_path.repo,
                    scrollToLine:
                      newMessage.focused_chunk.start_line > -1
                        ? `${newMessage.focused_chunk.start_line}_${newMessage.focused_chunk.end_line}`
                        : undefined,
                  },
                  side === 'left' ? 'right' : 'left',
                );
              }
              firstResultCame = true;
            }
          } else if (data?.Ok?.StreamEnd) {
            const message = data.Ok.StreamEnd;
            conversation_id = message.conversation_id;
            setThreadId(message.thread_id);
            setConversationId(message.conversation_id);
            if (conversation.length < 2) {
              updateTabProperty<ChatTabType, 'conversationId'>(
                tabKey,
                'conversationId',
                message.conversation_id,
                side,
              );
            }
            eventSource.current?.close();
            eventSource.current = null;
            setLoading(false);
            setConversation((prev) => {
              const newConversation = prev.slice(0, -1);
              const lastMessage = {
                ...prev.slice(-1)[0],
                isLoading: false,
              };
              return [...newConversation, lastMessage];
            });
            refreshCurrentProjectStudios();
            setTimeout(() => focusInput(), 100);
            return;
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
    },
    [conversationId, t, queryIdToEdit, preferredAnswerSpeed, openNewTab, side],
  );

  useEffect(() => {
    return () => {
      eventSource.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!submittedQuery.plain) {
      return;
    }
    let userQuery = submittedQuery.plain;
    let userQueryParsed = submittedQuery.parsed;
    const options = submittedQuery.options;
    if (submittedQuery.plain.startsWith('#explain_')) {
      const [prefix, ending] = submittedQuery.plain.split(':');
      const [lineStart, lineEnd] = ending.split('-');
      const filePath = prefix.slice(9);
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
    setConversation((prev) => {
      return prev.length === 1 && submittedQuery.options
        ? prev
        : [
            ...prev,
            {
              author: ChatMessageAuthor.User,
              text: userQuery,
              parsedQuery: userQueryParsed,
              isLoading: false,
            },
          ];
    });
    makeSearch(userQuery, options);
  }, [submittedQuery]);

  useEffect(() => {
    if (conversation.length && conversation.length < 3 && !tabTitle) {
      updateTabProperty<ChatTabType, 'title'>(
        tabKey,
        'title',
        conversation[0].text,
        side,
      );
    }
  }, [conversation, tabKey, side, tabTitle]);

  const stopGenerating = useCallback(() => {
    eventSource.current?.close();
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
    setStudios((prev) => {
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
    setStudios((prev) => {
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
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], onMessageEditCancel } };
    });
  }, [onMessageEditCancel]);

  useEffect(() => {
    // if it was open from history and not updated from sse message
    if (stId && project?.id && !conversation.length) {
      getCodeStudio(project.id, stId).then((resp) => {
        console.log(resp);
        // const conv: ChatMessage[] = [];
        // let hasOpenedTab = false;
        // resp.exchanges.forEach((m) => {
        //   // @ts-ignore
        //   const userQuery = m.search_steps.find((s) => s.type === 'QUERY');
        //   const parsedQuery = mapUserQuery(m);
        //   conv.push({
        //     author: ChatMessageAuthor.User,
        //     text: m.query.raw_query || userQuery?.content?.query || '',
        //     parsedQuery,
        //     isFromHistory: true,
        //   });
        //   conv.push({
        //     author: ChatMessageAuthor.Server,
        //     isLoading: false,
        //     loadingSteps: mapLoadingSteps(m.search_steps, t),
        //     text: m.answer,
        //     conclusion: m.conclusion,
        //     queryId: m.id,
        //     responseTimestamp: m.response_timestamp,
        //     explainedFile: m.focused_chunk?.repo_path.path,
        //   });
        //   if (!hasOpenedTab && m.focused_chunk?.repo_path) {
        //     openNewTab(
        //       {
        //         type: TabTypesEnum.FILE,
        //         path: m.focused_chunk.repo_path.path,
        //         repoRef: m.focused_chunk.repo_path.repo,
        //         scrollToLine:
        //           m.focused_chunk.start_line > -1
        //             ? `${m.focused_chunk.start_line}_${m.focused_chunk.end_line}`
        //             : undefined,
        //       },
        //       side === 'left' ? 'right' : 'left',
        //     );
        //     hasOpenedTab = true;
        //   }
        // });
        // setConversation(conv);
      });
    }
  }, [stId, project?.id]);

  return null;
};

export default memo(StudioPersistentState);
