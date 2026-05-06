import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

let initialized = false;

export const initObservability = () => {
  if (initialized || !dsn) return;
  initialized = true;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0.05,
  });
};

export const captureClientException = (error: unknown, context?: Record<string, unknown>) => {
  if (dsn) {
    Sentry.captureException(error, { extra: context });
    return;
  }
  if (import.meta.env.DEV) {
    console.error('[captureClientException]', error, context);
  }
};
