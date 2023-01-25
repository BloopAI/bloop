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
}

export const AnalyticsContextProvider: React.FC<AnalyticsProviderProps> = ({
  children,
  deviceId,
}) => {
  const WRITE_KEY = import.meta.env.PROD
    ? import.meta.env.ANALYTICS_WRITE_KEY_PROD
    : import.meta.env.ANALYTICS_WRITE_KEY_DEV;

  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);

  const [isAnalyticsAllowed, setIsAnalyticsAllowed] = useState(
    getPlainFromStorage(IS_ANALYTICS_ALLOWED_KEY) === 'true',
  );

  const loadAnalytics = async () => {
    if (!WRITE_KEY || analyticsLoaded) {
      return;
    }
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Failed to initialize analytics'));
      }, 2000);

      analytics.load(WRITE_KEY, import.meta.env.ANALYTICS_DATA_PLANE_URL, {
        logLevel: 'DEBUG',
        integrations: { All: true },
      });

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
  }, [WRITE_KEY, isAnalyticsAllowed]);

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
