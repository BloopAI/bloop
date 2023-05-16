import { useCallback } from 'react';
import * as analytics from 'rudder-sdk-js';

const useAnalytics = () => {
  const trackSearch = useCallback(
    (queryTime: number, query: string, searchId?: string) => {
      analytics?.track('Search', {
        queryTime,
        query,
        searchId,
      });
    },
    [analytics],
  );

  const trackUpvote = useCallback(
    (isUpvote: boolean, query: string, answer: string, searchId: string) => {
      analytics?.track('Upvote', {
        isUpvote,
        query,
        answer,
        searchId,
      });
    },
    [analytics],
  );

  const trackReposSelected = useCallback(
    ({
      localRepos,
      githubRepos,
      publicGithubRepos,
      where,
    }: {
      localRepos: number;
      githubRepos: number;
      publicGithubRepos?: number;
      where: string;
    }) => {
      analytics?.track('Repos Selected', {
        localRepos,
        githubRepos,
        publicGithubRepos,
        where,
      });
    },
    [analytics],
  );

  return {
    trackSearch,
    trackReposSelected,
    trackUpvote,
  };
};

export default useAnalytics;
