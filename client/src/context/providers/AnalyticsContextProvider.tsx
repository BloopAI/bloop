import React, { useState, useEffect, useMemo } from 'react';
import * as analytics from 'rudder-sdk-js';
import { AnalyticsContext } from '../analyticsContext';
import { EnvConfig } from '../../types/general';

interface AnalyticsProviderProps {
  children: React.ReactNode;
  forceAnalytics?: boolean;
  isSelfServe?: boolean;
  envConfig: EnvConfig;
}

export const AnalyticsContextProvider: React.FC<AnalyticsProviderProps> = ({
  children,
  isSelfServe,
  envConfig,
}) => {
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);

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
    if (analyticsLoaded && envConfig.tracking_id) {
      analytics.identify(
        envConfig.tracking_id.trim(),
        {
          isSelfServe: isSelfServe,
          githubUsername: envConfig.github_user?.login || '',
          orgName: envConfig.org_name || '',
          deviceId: envConfig.device_id?.trim(),
        },
        {},
        () => {},
      );
    }
  }, [analyticsLoaded, envConfig.tracking_id]);

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
};
