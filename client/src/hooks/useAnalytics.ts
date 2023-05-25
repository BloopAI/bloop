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
    (
      isUpvote: boolean,
      query: string,
      answer: string,
      searchId: string,
      comment?: string,
    ) => {
      analytics?.track('Upvote', {
        isUpvote,
        query,
        answer,
        searchId,
        comment,
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

  const trackReposSynced = useCallback(
    ({
      localRepos,
      githubRepos,
    }: {
      localRepos: number;
      githubRepos: number;
    }) => {
      analytics?.track('Repos Synced', {
        localRepos,
        githubRepos,
      });
    },
    [analytics],
  );

  return {
    trackSearch,
    trackReposSelected,
    trackUpvote,
    trackReposSynced,
  };
};

export default useAnalytics;
