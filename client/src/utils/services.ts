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

export const initializeSentry = (dsn: string, release: string) => {
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
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
};
