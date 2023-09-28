import * as Sentry from '@sentry/react';
import { ExtraErrorData } from '@sentry/integrations';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { Integration } from '@sentry/types/types/integration';
import { EnvConfig } from '../types/general';

let isInitialized = false;
export const initializeSentry = (envConfig: EnvConfig, release: string) => {
  if (!envConfig.sentry_dsn_fe || isInitialized) {
    return;
  }
  const isCloud = !!envConfig.org_name;
  const isUserAgreed = envConfig.bloop_user_profile?.allow_session_recordings;
  const recordingsAllowed = isCloud && isUserAgreed;
  const integrations: Integration[] = [
    new Sentry.BrowserTracing({
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      ),
    }),
    new ExtraErrorData(),
  ];
  if (recordingsAllowed) {
    integrations.push(
      new Sentry.Replay({
        maskAllText: false,
        networkDetailAllowUrls: [window.location.origin],
      }),
    );
  }
  try {
    Sentry.init({
      dsn: envConfig.sentry_dsn_fe,
      integrations,
      ...(recordingsAllowed
        ? {
            replaysSessionSampleRate: 1.0,
            replaysOnErrorSampleRate: 1.0,
          }
        : {}),
      environment: import.meta.env.MODE,
      release,
      tracesSampleRate: 0.1,
    });
    isInitialized = true;

    Sentry.setUser({
      id: envConfig.tracking_id,
      username: envConfig.user_login,
      device_id: envConfig.device_id,
    });
  } catch (err) {
    console.error(err);
  }
};
