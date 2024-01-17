import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import throttle from 'lodash.throttle';
import { DeviceContext } from '../../../context/deviceContext';
import { ProjectContext } from '../../../context/projectContext';
import {
  DiffHunkType,
  StudioConversationMessage,
  StudioConversationMessageAuthor,
  StudioTabType,
} from '../../../types/general';
import { TabsContext } from '../../../context/tabsContext';
import {
  confirmStudioDiff,
  generateStudioDiff,
  getCodeStudio,
  patchCodeStudio,
} from '../../../services/api';
import { StudiosContext } from '../../../context/studiosContext';
import {
  CodeStudioMessageType,
  CodeStudioType,
  GeneratedCodeDiff,
} from '../../../types/api';
import { PersonalQuotaContext } from '../../../context/personalQuotaContext';
import { UIContext } from '../../../context/uiContext';

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

function mapConversation(
  messages: CodeStudioMessageType[],
): StudioConversationMessage[] {
  return messages.map((m) => {
    const author = Object.keys(m)[0] as StudioConversationMessageAuthor;
    return { author, message: Object.values(m)[0] };
  });
}

const StudioPersistentState = ({ tabKey, side }: Props) => {
  const { t } = useTranslation();
  const { apiUrl } = useContext(DeviceContext);
  const { refetchQuota } = useContext(PersonalQuotaContext.Handlers);
  const { requestsLeft } = useContext(PersonalQuotaContext.Values);
  const { setIsUpgradeRequiredPopupOpen } = useContext(
    UIContext.UpgradeRequiredPopup,
  );
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

  const [tokenCount, setTokenCount] = useState(0);
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
              setTokenCount(s.token_counts.total);
            }
            if (key === 'messages') {
              const mappedConv = mapConversation(s.messages);
              setConversation(mappedConv);
            }
          } else {
            const mappedConv = mapConversation(s.messages);
            setTokenCount(s.token_counts.total);
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
    refetchCodeStudio();
  }, [refetchCodeStudio]);

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
    refetchQuota();
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
    if (!requestsLeft) {
      setIsUpgradeRequiredPopupOpen(true);
      return;
    }
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
      `${apiUrl.replace('https:', '')}/projects/${
        project.id
      }/studios/${tabKey}/generate`,
    );
    eventSource.current.onerror = (err) => {
      console.log('SSE error', err);
      refetchQuota();
      setConversation((prev) => {
        const newConv = [
          ...prev,
          {
            author: StudioConversationMessageAuthor.ASSISTANT,
            message: '',
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
    let i = 0;
    eventSource.current.onmessage = (ev) => {
      if (ev.data === '[DONE]') {
        eventSource.current?.close();
        setIsLoading(false);
        refetchCodeStudio();
        return;
      }
      try {
        const data = JSON.parse(ev.data);
        if (data.Ok) {
          const newMessage = data.Ok;
          if (i === 0) {
            refetchQuota();
            setConversation((prev) => {
              const newConv = [
                ...prev,
                {
                  author: StudioConversationMessageAuthor.ASSISTANT,
                  message: newMessage,
                },
              ];
              saveConversation(false, newConv);
              return newConv;
            });
          } else {
            setConversation((prev) => {
              const newConv = [
                ...prev.slice(0, -1),
                {
                  author: StudioConversationMessageAuthor.ASSISTANT,
                  message: newMessage,
                },
              ];
              saveConversation(false, newConv);
              return newConv;
            });
          }
          i++;
        } else if (data.Err) {
          refetchQuota();
          setConversation((prev) => {
            const newConv = [
              ...prev,
              {
                author: StudioConversationMessageAuthor.ASSISTANT,
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
    requestsLeft,
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

  const hasCodeBlock = useMemo(() => {
    return conversation.some(
      (m) =>
        m.author === StudioConversationMessageAuthor.ASSISTANT &&
        m.message.includes('```'),
    );
  }, [conversation]);

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

  const handleCancelDiff = useCallback(() => {
    abortController.current?.abort();
    setWaitingForDiff(false);
  }, []);

  const handleConfirmDiff = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
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
    },
    [tabKey, diff, project?.id],
  );

  const onDiffChanged = useCallback((i: number, v: string) => {
    setDiff((prev) => {
      const newValue: GeneratedCodeDiff = JSON.parse(JSON.stringify(prev));
      newValue.chunks[i].raw_patch = v;
      const newHunks: DiffHunkType[] = v
        .split(/\n(?=@@ -)/)
        .slice(1)
        .map((h) => {
          const startLine = h.match(/@@ -(\d+)/)?.[1];
          return {
            line_start: Number(startLine),
            patch: h.split('\n').slice(1).join('\n'),
          };
        });
      newValue.chunks[i].hunks = newHunks;
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

  const isDiffForLocalRepo = useMemo(() => {
    return diff?.chunks.find((c) => c.repo.startsWith('local//'));
  }, [diff]);

  // useEffect(() => {
  //   if (conversation.length && conversation.length < 3 && !tabTitle) {
  //     updateTabProperty<ChatTabType, 'title'>(
  //       tabKey,
  //       'title',
  //       conversation[0].text,
  //       side,
  //     );
  //   }
  // }, [conversation, tabKey, side, tabTitle]);

  return null;
};

export default memo(StudioPersistentState);
