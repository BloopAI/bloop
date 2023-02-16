import { useContext, useEffect, useState } from 'react';
import {
  search as searchApiCall,
  nlSearch as nlSearchApiCall,
} from '../services/api';
import { SearchContext } from '../context/searchContext';
import { SearchType } from '../types/general';
import { DeviceContext } from '../context/deviceContext';
import useAnalytics from './useAnalytics';

interface Status<T> {
  loading: boolean;
  error?: Error;
  data?: T;
  query?: string;
}

interface SearchResponse<T> extends Status<T> {
  searchQuery: (
    q: string,
    page?: number,
    globalRegex?: boolean,
    forceSearchType?: SearchType,
  ) => void;
}

export const useSearch = <T,>(
  query?: string,
  page: number = 0,
): SearchResponse<T> => {
  const [status, setStatus] = useState<Status<T>>({
    loading: false,
  });
  const { deviceId, apiUrl } = useContext(DeviceContext);

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
        const eventSource = new EventSource(
          `${apiUrl.replace(
            'https:',
            '',
          )}/answer?q=${query}&user_id=${deviceId}`,
        );
        eventSource.onmessage = (ev) => {
          const queryTime = Date.now() - startTime;
          setLastQueryTime(queryTime);
          trackSearch(queryTime);
          setStatus({ loading: false, data: JSON.parse(ev.data), query });
          // close connection after first message containing JSON, the rest will be accepted in Answer comp
          eventSource.close();
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
            trackSearch(queryTime);
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
