import React, { useState, useEffect, useMemo } from 'react';
import * as analytics from 'rudder-sdk-js';
import * as Sentry from '@sentry/react';
import { AnalyticsContext } from '../analyticsContext';
import {
  getPlainFromStorage,
  IS_ANALYTICS_ALLOWED_KEY,
} from '../../services/storage';

interface AnalyticsProviderProps {
  children: React.ReactNode;
  deviceId?: string;
  forceAnalytics?: boolean;
  envConfig: {
    analytics_data_plane?: string;
    analytics_key_fe?: string;
  };
}

export const AnalyticsContextProvider: React.FC<AnalyticsProviderProps> = ({
  children,
  deviceId,
  forceAnalytics,
  envConfig,
}) => {
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);

  const [isAnalyticsAllowed, setIsAnalyticsAllowed] = useState(
    forceAnalytics || getPlainFromStorage(IS_ANALYTICS_ALLOWED_KEY) === 'true',
  );

  const loadAnalytics = async () => {
    if (
      !envConfig.analytics_key_fe ||
      !envConfig.analytics_data_plane ||
      analyticsLoaded
    ) {
      return;
    }
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Failed to initialize analytics'));
        Sentry.captureException('Failed to initialize analytics');
      }, 5000);

      analytics.load(
        envConfig.analytics_key_fe!,
        envConfig.analytics_data_plane!,
        {
          logLevel: 'DEBUG',
          integrations: { All: true },
        },
      );

      analytics.ready(() => {
        setAnalyticsLoaded(true);
        analytics.track('Launch');
        clearTimeout(timeout);
        resolve();
      });
    });
  };

  useEffect(() => {
    if (analyticsLoaded && deviceId) {
      analytics.identify(deviceId);
    }
  }, [analyticsLoaded, deviceId]);

  useEffect(() => {
    if (isAnalyticsAllowed) {
      loadAnalytics().catch(console.log);
    } else {
      setAnalyticsLoaded(false);
    }
  }, [envConfig.analytics_key_fe, isAnalyticsAllowed]);

  const analyticsContextValue = useMemo(
    () => ({ setIsAnalyticsAllowed, isAnalyticsAllowed, analyticsLoaded }),
    [isAnalyticsAllowed],
  );

  return (
    <AnalyticsContext.Provider value={analyticsContextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
};
