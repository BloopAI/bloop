import { useContext, useEffect, useState } from 'react';
import { search as searchApiCall } from '../services/api';
import { SearchContext } from '../context/searchContext';
import { SearchType } from '../types/general';
import { DeviceContext } from '../context/deviceContext';
import useAnalytics from './useAnalytics';

interface Status<T> {
  loading: boolean;
  error?: Error | string;
  data?: T;
  query?: string;
  nlAnswer?: string;
}

interface SearchResponse<T> extends Status<T> {
  searchQuery: (
    q: string,
    page?: number,
    globalRegex?: boolean,
    forceSearchType?: SearchType,
  ) => void;
}

let prevEventSource: EventSource | undefined;

export const useSearch = <T,>(
  query?: string,
  page: number = 0,
): SearchResponse<T> => {
  const [status, setStatus] = useState<Status<T>>({
    loading: false,
  });
  const { apiUrl } = useContext(DeviceContext);

  const { setLastQueryTime, searchType } = useContext(SearchContext);
  const { trackSearch } = useAnalytics();

  const searchQuery = (
    query: string,
    page = 0,
    globalRegex?: boolean,
    forceSearchType?: SearchType,
  ) => {
    setStatus({ loading: true });

    const startTime = Date.now();
    const currentSearchType =
      forceSearchType !== undefined ? forceSearchType : searchType;

    switch (currentSearchType) {
      case SearchType.NL:
        prevEventSource?.close();
        const eventSource = new EventSource(
          `${apiUrl.replace('https:', '')}/answer?q=${query}`,
        );
        prevEventSource = eventSource;
        let i = 0;
        eventSource.onmessage = (ev) => {
          if (ev.data === '[DONE]') {
            eventSource.close();
            prevEventSource = undefined;
          } else {
            const newData = JSON.parse(ev.data);

            if (i === 0) {
              const queryTime = Date.now() - startTime;
              setLastQueryTime(queryTime);
              trackSearch(queryTime, query, newData.query_id);
              if (newData.Err) {
                setStatus((prev) => ({
                  ...prev,
                  loading: false,
                  error: newData.Err,
                }));
              } else {
                const nlAnswer = newData.answer_path
                  ? ''
                  : 'One of the the results below could be relevant...';
                setStatus({ loading: false, data: newData, query, nlAnswer });
              }
            } else {
              setStatus((prev) => ({
                ...prev,
                nlAnswer: (prev.nlAnswer || '') + newData.Ok,
              }));
            }
            i++;
          }
        };
        eventSource.onerror = (err) => {
          console.error('EventSource failed:', err);
          setStatus({
            loading: false,
            error: { name: 'Error', message: 'Oops' },
          });
        };
        break;
      case SearchType.REGEX:
        searchApiCall(query, page, undefined, globalRegex)
          .then((res: any) => {
            const queryTime = Date.now() - startTime;
            setLastQueryTime(queryTime);
            trackSearch(queryTime, query);
            setStatus({ loading: false, data: res });
          })
          .catch((error: Error) => {
            setStatus({ loading: false, error });
          });
    }
  };

  useEffect(() => {
    if (query) {
      searchQuery(query, page);
    }
  }, []);

  return { ...status, searchQuery };
};
