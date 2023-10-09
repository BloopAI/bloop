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

  const trackUpgradePopup = useCallback(() => {
    analytics?.track('Studio limit reached');
  }, []);

  return {
    trackSearch,
    trackUpgradePopup,
  };
};

export default useAnalytics;
