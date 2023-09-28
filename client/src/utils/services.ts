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
  // if is on cloud
  if (envConfig.org_name) {
    integrations.push(
      new Sentry.Replay({
        maskAllText: false,
      }),
    );
  }
  try {
    Sentry.init({
      dsn: envConfig.sentry_dsn_fe,
      integrations,
      ...(envConfig.org_name
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
