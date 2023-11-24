import React, { useState, useEffect, useMemo, memo, useContext } from 'react';
import * as analytics from 'rudder-sdk-js';
import { AnalyticsContext } from '../analyticsContext';
import { EnvContext } from '../envContext';

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

export const AnalyticsContextProvider: React.FC<AnalyticsProviderProps> = memo(
  ({ children }) => {
    const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
    const { envConfig } = useContext(EnvContext);

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
        console.log('analytics ready');
      });
      setAnalyticsLoaded(true);
      analytics.track('Launch');
    };

    useEffect(() => {
      loadAnalytics();
    }, [envConfig.analytics_key_fe]);

    const analyticsContextValue = useMemo(
      () => ({ analyticsLoaded }),
      [analyticsLoaded],
    );

    return (
      <AnalyticsContext.Provider value={analyticsContextValue}>
        {children}
      </AnalyticsContext.Provider>
    );
  },
);

AnalyticsContextProvider.displayName = 'AnalyticsContextProvider';
