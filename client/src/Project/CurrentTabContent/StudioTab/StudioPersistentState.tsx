import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import throttle from 'lodash.throttle';
import { DeviceContext } from '../../../context/deviceContext';
import { ProjectContext } from '../../../context/projectContext';
import {
  StudioConversationMessage,
  StudioConversationMessageAuthor,
  StudioTabType,
} from '../../../types/general';
import { TabsContext } from '../../../context/tabsContext';
import {
  API_BASE_URL,
  confirmStudioDiff,
  generateStudioDiff,
  getCodeStudio,
  patchCodeStudio,
} from '../../../services/api';
import { StudiosContext } from '../../../context/studiosContext';
import {
  CodeStudioTokenCountType,
  CodeStudioType,
  GeneratedCodeDiff,
} from '../../../types/api';
import { mapConversation } from '../../../utils/mappers';

type Props = {
  tabKey: string; //studioId
  side: 'left' | 'right';
};

const throttledPatch = throttle(
  (projectId, studioId, data) => {
    return patchCodeStudio(projectId, studioId, data);
  },
  2000,
  { leading: false, trailing: true },
);

const StudioPersistentState = ({ tabKey, side }: Props) => {
  const { t } = useTranslation();
  const { project, refreshCurrentProjectStudios } = useContext(
    ProjectContext.Current,
  );
  const { setStudios } = useContext(StudiosContext);
  const { updateTabProperty } = useContext(TabsContext.Handlers);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const eventSource = useRef<EventSource | null>(null);

  const [name, setName] = useState('');

  const [inputValue, setInputValue] = useState('');
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], inputValue } };
    });
  }, [inputValue]);

  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], isLoading } };
    });
  }, [isLoading]);

  const [conversation, setConversation] = useState<StudioConversationMessage[]>(
    [],
  );
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], conversation } };
    });
  }, [conversation]);

  const [inputAuthor, setInputAuthor] = useState(
    StudioConversationMessageAuthor.USER,
  );
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], inputAuthor } };
    });
  }, [inputAuthor]);

  const [tokenCount, setTokenCount] = useState<CodeStudioTokenCountType | null>(
    null,
  );
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], tokenCount } };
    });
  }, [tokenCount]);

  const [waitingForDiff, setWaitingForDiff] = useState(false);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], waitingForDiff } };
    });
  }, [waitingForDiff]);

  const [isDiffApplied, setDiffApplied] = useState(false);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], isDiffApplied } };
    });
  }, [isDiffApplied]);

  const [isDiffApplyError, setDiffApplyError] = useState(false);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], isDiffApplyError } };
    });
  }, [isDiffApplyError]);

  const [isDiffGenFailed, setDiffGenFailed] = useState(false);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], isDiffGenFailed } };
    });
  }, [isDiffGenFailed]);

  const [diff, setDiff] = useState<GeneratedCodeDiff | null>(null);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], diff } };
    });
  }, [diff]);

  useEffect(() => {
    setStudios((prev) => {
      return {
        ...prev,
        [tabKey]: {
          ...prev[tabKey],
          setConversation,
          setDiff,
        },
      };
    });
  }, []);

  const refetchCodeStudio = useCallback(
    (key?: keyof CodeStudioType) => {
      if (tabKey && project?.id) {
        return getCodeStudio(project.id, tabKey).then((s) => {
          if (key) {
            if (key === 'token_counts') {
              setTokenCount(s.token_counts);
            }
            if (key === 'messages') {
              const mappedConv = mapConversation(s.messages);
              setConversation(mappedConv);
            }
          } else {
            const mappedConv = mapConversation(s.messages);
            setTokenCount(s.token_counts);
            setName(s.name);
            if (
              mappedConv[mappedConv.length - 1]?.author ===
              StudioConversationMessageAuthor.USER
              // && !isPreviewing
            ) {
              const editedMessage = mappedConv[s.messages.length - 1];
              setInputValue((prev) =>
                prev < editedMessage.message ? editedMessage.message : prev,
              );
              setConversation(mappedConv.slice(0, -1));
            } else {
              setConversation(mappedConv);
            }
          }
        });
      }
    },
    [tabKey, project?.id, side],
  );
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], refetchCodeStudio } };
    });
  }, [refetchCodeStudio]);

  useEffect(() => {
    refetchCodeStudio();
  }, [refetchCodeStudio, project?.repos, project?.studios]);

  useEffect(() => {
    if (name) {
      updateTabProperty<StudioTabType, 'title'>(tabKey, 'title', name, side);
      refreshCurrentProjectStudios();
    }
  }, [name]);

  const setInput = useCallback((value: StudioConversationMessage) => {
    setInputValue(value.message);
    setInputAuthor(value.author);
    // Focus on the input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const saveConversation = useCallback(
    async (
      force?: boolean,
      newConversation?: StudioConversationMessage[],
      newInput?: string,
    ) => {
      if (!project?.id) {
        return;
      }
      const messages: ({ User: string } | { Assistant: string })[] = (
        newConversation || conversation
      )
        .map((c) => ({ [c.author as 'User']: c.message }))
        .concat(
          !newConversation && (newInput || inputValue)
            ? [{ [inputAuthor as 'User']: newInput || inputValue }]
            : [],
        );
      if (force) {
        await patchCodeStudio(project.id, tabKey, {
          messages,
        });
      } else {
        throttledPatch(project.id, tabKey, {
          messages,
        });
      }
    },
    [conversation, inputValue, inputAuthor],
  );

  const onMessageChange = useCallback(
    (message: string, i?: number) => {
      if (i === undefined) {
        setInputValue(message);
        saveConversation(false, undefined, message);
      } else {
        setConversation((prev) => {
          const newConv = JSON.parse(JSON.stringify(prev));
          newConv[i].message = message;
          saveConversation(false, newConv);
          return newConv;
        });
      }
    },
    [saveConversation],
  );
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], onMessageChange } };
    });
  }, [onMessageChange]);

  const handleCancel = useCallback(() => {
    eventSource.current?.close();
    setIsLoading(false);
    if (
      conversation[conversation.length - 1]?.author ===
      StudioConversationMessageAuthor.USER
    ) {
      const editedMessage = conversation[conversation.length - 1];
      setInputValue((prev) =>
        prev < editedMessage.message ? editedMessage.message : prev,
      );
      setConversation(conversation.slice(0, -1));
      saveConversation(false, conversation.slice(0, -1));
    } else {
      const newConv = [
        ...conversation.slice(0, -1),
        { ...conversation[conversation.length - 1], isLoading: false },
      ];
      setConversation(newConv);
      saveConversation();
    }
  }, [conversation]);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], handleCancel } };
    });
  }, [handleCancel]);

  const onSubmit = useCallback(async () => {
    if (!inputValue || !project?.id) {
      return;
    }
    await saveConversation(true);
    setDiffApplied(false);
    setDiffApplyError(false);
    setDiff(null);
    setDiffGenFailed(false);
    setConversation((prev) => [
      ...prev,
      { message: inputValue, author: inputAuthor },
    ]);
    setInput({
      author: StudioConversationMessageAuthor.USER,
      message: '',
    });
    setIsLoading(true);

    eventSource.current?.close();
    eventSource.current = new EventSource(
      `${API_BASE_URL}/projects/${project.id}/studios/${tabKey}/generate`,
    );
    eventSource.current.onerror = (err) => {
      console.log('SSE error', err);
      setConversation((prev) => {
        const newConv = [
          ...prev,
          {
            author: StudioConversationMessageAuthor.ASSISTANT,
            message: '',
            isLoading: false,
            error: t(
              "We couldn't answer your question. You can try asking again in a few moments, or rephrasing your question.",
            ),
          },
        ];
        saveConversation(false, newConv);
        return newConv;
      });
      setIsLoading(false);
      eventSource.current?.close();
    };
    setConversation((prev) => {
      return [
        ...prev,
        {
          author: StudioConversationMessageAuthor.ASSISTANT,
          isLoading: true,
          message: '',
        },
      ];
    });
    let i = 0;
    eventSource.current.onmessage = (ev) => {
      if (ev.data === '[DONE]') {
        eventSource.current?.close();
        setIsLoading(false);
        setConversation((prev) => {
          return [
            ...prev.slice(0, -1),
            {
              ...prev[prev.length - 1],
              isLoading: false,
            },
          ];
        });
        refetchCodeStudio();
        return;
      }
      try {
        const data = JSON.parse(ev.data);
        if (data.Ok) {
          const newMessage = data.Ok;
          setConversation((prev) => {
            const newConv = [
              ...prev.slice(0, -1),
              {
                author: StudioConversationMessageAuthor.ASSISTANT,
                isLoading: true,
                message: newMessage,
              },
            ];
            saveConversation(false, newConv);
            return newConv;
          });
          i++;
        } else if (data.Err) {
          setConversation((prev) => {
            const newConv = [
              ...prev,
              {
                author: StudioConversationMessageAuthor.ASSISTANT,
                isLoading: false,
                message: data.Err,
              },
            ];
            saveConversation(false, newConv);
            return newConv;
          });
        }
      } catch (err) {
        setIsLoading(false);
        console.log('failed to parse response', err);
      }
    };
  }, [
    tabKey,
    conversation,
    inputValue,
    inputAuthor,
    saveConversation,
    project?.id,
  ]);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], onSubmit } };
    });
  }, [onSubmit]);

  useEffect(() => {
    return () => {
      eventSource.current?.close();
    };
  }, []);

  const onMessageRemoved = useCallback(
    async (i: number, andSubsequent?: boolean) => {
      if (andSubsequent) {
        // Set input to the message being removed
        setInput(conversation[i]);
      }
      setWaitingForDiff(false);
      setDiffGenFailed(false);
      setDiff(null);
      setDiffApplied(false);
      setDiffApplyError(false);
      if (
        i === conversation.length - 1 &&
        conversation[i].author === StudioConversationMessageAuthor.ASSISTANT &&
        isLoading
      ) {
        handleCancel();
      }
      setConversation((prev) => {
        const newConv = prev.filter((_, j) =>
          andSubsequent ? i > j : i !== j,
        );
        if (
          newConv[newConv.length - 1]?.author ===
          StudioConversationMessageAuthor.USER
        ) {
          const editedMessage = newConv[messages.length - 1];
          setInputValue(editedMessage.message);
          return newConv.slice(0, -1);
        }
        return newConv;
      });

      const messages = conversation.filter((m, j) =>
        andSubsequent ? i > j : i !== j,
      );
      await saveConversation(true, messages);
      refetchCodeStudio('token_counts');
    },
    [conversation, isLoading],
  );
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], onMessageRemoved } };
    });
  }, [onMessageRemoved]);

  const clearConversation = useCallback(async () => {
    if (!project?.id) {
      return;
    }
    await patchCodeStudio(project.id, tabKey, {
      messages: [],
    });
    setDiff(null);
    setWaitingForDiff(false);
    setDiffApplied(false);
    setDiffApplyError(false);
    setDiffGenFailed(false);
    setInput({
      author: StudioConversationMessageAuthor.USER,
      message: '',
    });
    setConversation([]);
    refetchCodeStudio('token_counts');
  }, [tabKey, project?.id]);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], clearConversation } };
    });
  }, [clearConversation]);

  const handleApplyChanges = useCallback(async () => {
    if (!project?.id) {
      return;
    }
    setWaitingForDiff(true);
    setDiffGenFailed(false);
    try {
      abortController.current = new AbortController();
      const resp = await generateStudioDiff(
        project.id,
        tabKey,
        abortController.current?.signal,
      );
      setDiff(resp);
    } catch (err) {
      console.log(err);
      setDiffGenFailed(true);
    } finally {
      setWaitingForDiff(false);
    }
  }, [tabKey, project?.id]);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], handleApplyChanges } };
    });
  }, [handleApplyChanges]);

  const handleCancelDiff = useCallback(() => {
    abortController.current?.abort();
    setWaitingForDiff(false);
  }, []);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], handleCancelDiff } };
    });
  }, [handleCancelDiff]);

  const handleConfirmDiff = useCallback(async () => {
    if (!diff || !project?.id) {
      return;
    }
    const result = diff.chunks.map((c) => c.raw_patch).join('');
    try {
      await confirmStudioDiff(project.id, tabKey, result);
      setDiff(null);
      setDiffApplied(true);
    } catch (err: unknown) {
      console.log(err);
      // @ts-ignore
      if (err.code !== 'ERR_CANCELED') {
        setDiffApplyError(true);
      }
    }
  }, [tabKey, diff, project?.id]);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], handleConfirmDiff } };
    });
  }, [handleConfirmDiff]);

  const onDiffChanged = useCallback((i: number, v: string) => {
    setDiff((prev) => {
      const newValue: GeneratedCodeDiff = JSON.parse(JSON.stringify(prev));
      newValue.chunks[i].raw_patch = v;
      newValue.chunks[i].hunks = v
        .split(/\n(?=@@ -)/)
        .slice(1)
        .map((h) => {
          const startLine = h.match(/@@ -(\d+)/)?.[1];
          return {
            line_start: Number(startLine),
            patch: h.split('\n').slice(1).join('\n'),
          };
        });
      return newValue;
    });
  }, []);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], onDiffChanged } };
    });
  }, [onDiffChanged]);

  const onDiffRemoved = useCallback((i: number) => {
    setDiff((prev) => {
      const newValue: GeneratedCodeDiff = JSON.parse(JSON.stringify(prev));
      newValue.chunks.splice(i, 1);
      if (!newValue.chunks.length) {
        return null;
      }
      return newValue;
    });
  }, []);
  useEffect(() => {
    setStudios((prev) => {
      return { ...prev, [tabKey]: { ...prev[tabKey], onDiffRemoved } };
    });
  }, [onDiffRemoved]);

  return null;
};

export default memo(StudioPersistentState);
