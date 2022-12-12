import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';

export const initializeSentry = (release: string) => {
  Sentry.init({
    dsn: 'https://79266c6b7c1e4fbca430019e2acaf941@o4504254520426496.ingest.sentry.io/4504275760775168',
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
    ],
    environment: import.meta.env.MODE,
    release,
    tracesSampleRate: import.meta.env.MODE === 'development' ? 1.0 : 0.1,
  });
};
