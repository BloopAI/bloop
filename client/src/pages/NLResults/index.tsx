import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import { useNavigate } from 'react-router-dom';
import { FullResult, ResultClick } from '../../types/results';
import { mapFileResult, mapRanges } from '../../mappers/results';
import {
  ConversationMessage,
  FullResultModeEnum,
  SearchType,
} from '../../types/general';
import useAppNavigation from '../../hooks/useAppNavigation';
import ResultModal from '../ResultModal';
import { useSearch } from '../../hooks/useSearch';
import { FileSearchResponse, NLSnippet } from '../../types/api';
import ErrorFallback from '../../components/ErrorFallback';
import { getHoverables } from '../../services/api';
import { ResultsPreviewSkeleton } from '../../components/Skeleton';
import SemanticSearch from '../../components/CodeBlock/SemanticSearch';
import { DeviceContext } from '../../context/deviceContext';
import PageHeader from '../../components/ResultsPageHeader';
import useAnalytics from '../../hooks/useAnalytics';
import { conversationsCache } from '../../services/cache';
import { SearchContext } from '../../context/searchContext';
import Conversation from './Conversation';

type Props = {
  query: string;
  threadId: string;
};

let prevEventSource: EventSource | undefined;

const ResultsPage = ({ query, threadId }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const { apiUrl } = useContext(DeviceContext);
  const { setLastQueryTime } = useContext(SearchContext);
  const [isLoading, setIsLoading] = useState(!conversationsCache[threadId]);
  const [conversation, setConversation] = useState<ConversationMessage[]>(
    conversationsCache[threadId] || [
      { author: 'user', text: query, isLoading: false },
    ],
  );
  const [searchId, setSearchId] = useState('');
  const [mode, setMode] = useState<FullResultModeEnum>(
    FullResultModeEnum.MODAL,
  );
  const [scrollToLine, setScrollToLine] = useState<string | undefined>(
    undefined,
  );
  const [currentlyViewedSnippets, setCurrentlyViewedSnippets] = useState(0);
  const [openResult, setOpenResult] = useState<FullResult | null>(null);
  const { navigateRepoPath } = useAppNavigation();
  const { searchQuery: fileModalSearchQuery, data: fileResultData } =
    useSearch<FileSearchResponse>();
  const navigateBrowser = useNavigate();
  const { trackSearch } = useAnalytics();
  const [scopeRepos, setScopeRepos] = useState<string[]>([]);

  useEffect(() => {
    let loadedConversation = [...conversation];
    if (conversation[conversation.length - 1]?.isLoading) {
      loadedConversation[loadedConversation.length - 1] = {
        ...loadedConversation[loadedConversation.length - 1],
        isLoading: false,
      };
    }
    conversationsCache[threadId] = loadedConversation;
    const allRepoFlags: Set<string> = new Set();
    conversation.forEach((m) => {
      if (m.author === 'user') {
        const matches = Array.from(m.text?.matchAll(/\srepo:(\S+)/gim) || []);
        matches.forEach((m) => {
          allRepoFlags.add(m[1]);
        });
      }
    });
    setScopeRepos(Array.from(allRepoFlags));
  }, [conversation]);

  const onResultClick = useCallback<ResultClick>((repo, path, lineNumber) => {
    setScrollToLine(lineNumber ? lineNumber.join('_') : undefined);
    if (path) {
      fileModalSearchQuery(
        `open:true repo:${repo} path:${path}`,
        0,
        false,
        SearchType.REGEX,
      );
    } else {
      navigateRepoPath(repo);
    }
  }, []);

  const handleModeChange = useCallback((m: FullResultModeEnum) => {
    setMode(m);
  }, []);

  const onResultClosed = useCallback(() => {
    setOpenResult(null);
  }, [mode]);

  useEffect(() => {
    if (fileResultData) {
      setOpenResult(mapFileResult(fileResultData.data[0]));
      navigateBrowser({
        search: scrollToLine
          ? '?' +
            new URLSearchParams({
              scroll_line_index: scrollToLine.toString(),
            }).toString()
          : '',
      });
      getHoverables(
        fileResultData.data[0].data.relative_path,
        fileResultData.data[0].data.repo_ref,
      ).then((data) => {
        setOpenResult((prevState) => ({
          ...prevState!,
          hoverableRanges: mapRanges(data.ranges),
        }));
      });
    }
  }, [fileResultData]);

  const makeSearch = useCallback(
    (question: string) => {
      setIsLoading(true);
      prevEventSource?.close();
      const startTime = Date.now();
      const eventSource = new EventSource(
        `${apiUrl.replace('https:', '')}/answer?q=${encodeURIComponent(
          `${question} ${scopeRepos.map((r) => `repo:${r}`).join(' ')}`,
        )}&thread_id=${threadId}`,
      );
      prevEventSource = eventSource;
      setConversation((prev) => {
        const newConversation = prev?.slice(0, -1) || [];
        const lastMessages =
          prev?.slice(-1)[0]?.isLoading &&
          prev?.slice(-1)[0]?.author === 'server'
            ? [{ author: 'server' as const, isLoading: true }]
            : [
                ...prev.slice(-1),
                { author: 'server' as const, isLoading: true },
              ];
        return [...newConversation, ...lastMessages];
      });
      let i = 0;
      eventSource.onmessage = (ev) => {
        if (ev.data === '[DONE]') {
          eventSource.close();
          setConversation((prev) => {
            const newConversation = prev.slice(0, -1);
            const lastMessage = {
              ...prev.slice(-1)[0],
              isLoading: false,
            };
            return [...newConversation, lastMessage];
          });
          prevEventSource = undefined;
        } else {
          const newData = JSON.parse(ev.data);

          if (i === 0) {
            const queryTime = Date.now() - startTime;
            setLastQueryTime(queryTime);
            trackSearch(queryTime, query, threadId);
            if (newData.Err) {
              setIsLoading(false);
              setConversation((prev) => {
                const newConversation = prev.slice(0, -1);
                const lastMessage = {
                  ...prev.slice(-1)[0],
                  isLoading: false,
                  error: newData.Err,
                };
                return [...newConversation, lastMessage];
              });
            } else {
              setIsLoading(false);
              setSearchId(newData?.query_id);
              setConversation((prev) => {
                const newConversation = prev.slice(0, -1);
                const lastMessage = {
                  ...prev.slice(-1)[0],
                  isLoading: true,
                  snippets:
                    newData?.snippets?.matches?.map((item: NLSnippet) => ({
                      path: item.relative_path,
                      code: item.text,
                      repoName: item.repo_name,
                      lang: item.lang,
                      line: item.start_line,
                    })) || [],
                  text:
                    typeof newData === 'string' || newData.Ok
                      ? newData.Ok || newData
                      : '',
                };
                return [...newConversation, lastMessage];
              });
            }
          } else {
            setConversation((prev) => {
              const newConversation = prev.slice(0, -1);
              const lastMessage = {
                ...prev.slice(-1)[0],
                text: (prev.slice(-1)[0].text || '') + newData.Ok,
              };
              return [...newConversation, lastMessage];
            });
          }
          i++;
        }
      };
      eventSource.onerror = (err) => {
        console.error('EventSource failed:', err);
        setIsLoading(false);
        setConversation((prev) => {
          const newConversation = prev.slice(0, -1);
          const lastMessages =
            prev?.slice(-1)[0]?.isLoading &&
            prev?.slice(-1)[0]?.author === 'server'
              ? [
                  {
                    author: 'server' as const,
                    isLoading: false,
                    error: 'Sorry, something went wrong',
                  },
                ]
              : [
                  ...prev.slice(-1),
                  {
                    author: 'server' as const,
                    isLoading: false,
                    error: 'Sorry, something went wrong',
                  },
                ];
          return [...newConversation, ...lastMessages];
        });
      };
    },
    [scopeRepos],
  );

  useEffect(() => {
    if (
      !conversationsCache[threadId] ||
      conversationsCache[threadId].length === 1
    ) {
      makeSearch(query);
    }
  }, [query]);

  const lastServerResponse = useMemo(() => {
    const serverResponses = conversation.filter((m) => m.author === 'server');
    return serverResponses[serverResponses.length - 1];
  }, [conversation]);

  useEffect(() => {
    setCurrentlyViewedSnippets(conversation.length - 1);
  }, [lastServerResponse]);

  const handleNewMessage = useCallback(
    (message: string) => {
      setConversation((prev) => [
        ...prev,
        { author: 'user', text: message, isLoading: false },
      ]);
      makeSearch(message);
    },
    [makeSearch],
  );

  return (
    <>
      <div
        className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content"
        ref={ref}
      >
        <PageHeader
          resultsNumber={
            conversation[currentlyViewedSnippets]?.snippets?.length || 0
          }
          loading={isLoading}
        />
        {isLoading ? (
          <ResultsPreviewSkeleton />
        ) : !!conversation[currentlyViewedSnippets]?.snippets?.length ? (
          <SemanticSearch
            snippets={conversation[currentlyViewedSnippets].snippets || []}
            onClick={onResultClick}
          />
        ) : null}
      </div>
      <Conversation
        conversation={conversation}
        onNewMessage={handleNewMessage}
        onViewSnippetsClick={setCurrentlyViewedSnippets}
        currentlyViewedSnippets={currentlyViewedSnippets}
        searchId={threadId}
      />

      {openResult ? (
        <ResultModal
          result={openResult as FullResult}
          onResultClosed={onResultClosed}
          mode={mode}
          setMode={handleModeChange}
        />
      ) : (
        ''
      )}
    </>
  );
};
export default Sentry.withErrorBoundary(ResultsPage, {
  fallback: (props) => <ErrorFallback {...props} />,
});
