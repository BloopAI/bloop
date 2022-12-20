import { useContext, useEffect, useState } from 'react';
import { search as searchApiCall } from '../services/api';
import { SearchContext } from '../context/searchContext';
import useAnalytics from './useAnalytics';

interface Status<T> {
  loading: boolean;
  error?: Error;
  data?: T;
}

interface SearchResponse<T> extends Status<T> {
  searchQuery: (q: string, page?: number, globalRegex?: boolean) => void;
}

export const useSearch = <T,>(
  query?: string,
  page: number = 0,
): SearchResponse<T> => {
  const [status, setStatus] = useState<Status<T>>({
    loading: false,
  });

  const { setLastQueryTime } = useContext(SearchContext);
  const { trackSearch } = useAnalytics();

  const searchQuery = (query: string, page = 0, globalRegex?: boolean) => {
    setStatus({ loading: true });

    const startTime = Date.now();

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
  };

  useEffect(() => {
    if (query) {
      searchQuery(query, page);
    }
  }, []);

  return { ...status, searchQuery };
};
