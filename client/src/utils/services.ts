import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import {
  getPlainFromStorage,
  IS_ANALYTICS_ALLOWED_KEY,
} from '../services/storage';

export const telemetryAllowed = {
  value: getPlainFromStorage(IS_ANALYTICS_ALLOWED_KEY) === 'true',
};

const getIsTelemetryAllowed = () => telemetryAllowed.value;

export const initializeSentry = () => {
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
    release: '0.0.0',
    beforeSend: (event, hint) => {
      if (!getIsTelemetryAllowed()) {
        return null;
      }
      return event;
    },
    beforeSendTransaction: (event, hint) => {
      if (!getIsTelemetryAllowed()) {
        return null;
      }
      return event;
    },
    tracesSampleRate: !getIsTelemetryAllowed()
      ? 0
      : import.meta.env.MODE === 'development'
      ? 1.0
      : 0.1,
  });
};
