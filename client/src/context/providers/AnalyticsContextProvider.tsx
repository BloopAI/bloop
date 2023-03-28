import React, { useState, useEffect, useMemo } from 'react';
import * as analytics from 'rudder-sdk-js';
import { AnalyticsContext } from '../analyticsContext';
import {
  getPlainFromStorage,
  IS_ANALYTICS_ALLOWED_KEY,
} from '../../services/storage';

interface AnalyticsProviderProps {
  children: React.ReactNode;
  deviceId?: string;
  forceAnalytics?: boolean;
  isSelfServe?: boolean;
  envConfig: {
    analytics_data_plane?: string;
    analytics_key_fe?: string;
  };
}

export const AnalyticsContextProvider: React.FC<AnalyticsProviderProps> = ({
  children,
  deviceId,
  forceAnalytics,
  isSelfServe,
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
    });
  };

  useEffect(() => {
    if (analyticsLoaded && deviceId) {
      analytics.identify(deviceId, {
        isSelfServe: isSelfServe,
      });
    }
  }, [analyticsLoaded, deviceId]);

  useEffect(() => {
    if (isAnalyticsAllowed) {
      loadAnalytics();
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
