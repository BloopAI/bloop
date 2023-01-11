import React, { useState, useEffect, useMemo } from 'react';
import { AnalyticsBrowser, Analytics } from '@segment/analytics-next';
import { AnalyticsContext } from '../analyticsContext';
import {
  getPlainFromStorage,
  IS_ANALYTICS_ALLOWED_KEY,
} from '../../services/storage';

interface AnalyticsProviderProps {
  children: React.ReactNode;
  deviceId?: string;
}

export const AnalyticsContextProvider: React.FC<AnalyticsProviderProps> = ({
  children,
  deviceId,
}) => {
  const WRITE_KEY = import.meta.env.PROD
    ? import.meta.env.VITE_SEGMENT_WRITE_KEY_PROD
    : import.meta.env.VITE_SEGMENT_WRITE_KEY_DEV;

  const [analytics, setAnalytics] = useState<Analytics | undefined>(undefined);
  const [isAnalyticsAllowed, setIsAnalyticsAllowed] = useState(true);

  const loadAnalytics = async () => {
    if (!WRITE_KEY || analytics) {
      return;
    }

    const [response] = await AnalyticsBrowser.load({ writeKey: WRITE_KEY });
    setAnalytics(response);
    if (response) {
      response.track('Launch');
    }
  };

  useEffect(() => {
    if (analytics && deviceId) {
      analytics.identify(deviceId);
    }
  }, [analytics, deviceId]);

  useEffect(() => {
    if (isAnalyticsAllowed) {
      loadAnalytics();
    } else {
      setAnalytics(undefined);
    }
  }, [WRITE_KEY, isAnalyticsAllowed]);

  const analyticsContextValue = useMemo(
    () => ({ analytics, setIsAnalyticsAllowed, isAnalyticsAllowed }),
    [analytics, isAnalyticsAllowed],
  );

  return (
    <AnalyticsContext.Provider value={analyticsContextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
};
