import { useCallback, useContext } from 'react';
import { AnalyticsContext } from '../context/analyticsContext';

const useAnalytics = () => {
  const { analytics } = useContext(AnalyticsContext);

  const trackSearch = useCallback(
    (queryTime: number) => {
      analytics?.track('Search', {
        queryTime,
      });
    },
    [analytics],
  );

  const trackReposSelected = useCallback(
    ({
      localRepos,
      githubRepos,
      where,
    }: {
      localRepos: number;
      githubRepos: number;
      where: string;
    }) => {
      analytics?.track('Repos Selected', {
        localRepos,
        githubRepos,
        where,
      });
    },
    [analytics],
  );

  return {
    trackSearch,
    trackReposSelected,
  };
};

export default useAnalytics;
