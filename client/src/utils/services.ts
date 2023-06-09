import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { ExtraErrorData } from '@sentry/integrations';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { EnvConfig } from '../types/general';

export const initializeSentry = (envConfig: EnvConfig, release: string) => {
  if (!envConfig.sentry_dsn_fe) {
    return;
  }
  Sentry.init({
    dsn: envConfig.sentry_dsn_fe,
    integrations: [
      new BrowserTracing({
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
        ),
      }),
      new ExtraErrorData(),
    ],
    environment: import.meta.env.MODE,
    release,
    tracesSampleRate: import.meta.env.MODE === 'development' ? 1.0 : 0.1,
  });

  Sentry.setUser({
    id: envConfig.device_id,
    username: envConfig.user_login,
  });
};
