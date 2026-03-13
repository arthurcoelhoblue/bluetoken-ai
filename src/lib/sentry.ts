/**
 * Sentry initialization — error tracking, breadcrumbs, performance.
 * DSN is a publishable key (safe in frontend code).
 */

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
type SentryModule = typeof import('@sentry/react');

let sentryModule: SentryModule | null = null;
let sentryLoadPromise: Promise<SentryModule | null> | null = null;
let sentryInitStarted = false;

function loadSentry(): Promise<SentryModule | null> {
  if (!SENTRY_DSN) return Promise.resolve(null);
  if (sentryModule) return Promise.resolve(sentryModule);
  if (sentryLoadPromise) return sentryLoadPromise;

  sentryLoadPromise = import('@sentry/react')
    .then((mod) => {
      sentryModule = mod;
      return mod;
    })
    .catch((error) => {
      console.warn('[Sentry] SDK load failed, continuing without monitoring', error);
      return null;
    });

  return sentryLoadPromise;
}

export function initSentry() {
  if (!SENTRY_DSN || sentryInitStarted) return;
  sentryInitStarted = true;

  void loadSentry().then((Sentry) => {
    if (!Sentry) return;

    try {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
        ],
        tracesSampleRate: 0.1, // 10% of transactions
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0.5, // 50% of error sessions
        beforeSend(event) {
          // Strip PII from breadcrumbs
          if (event.breadcrumbs) {
            event.breadcrumbs = event.breadcrumbs.map((bc) => {
              if (bc.category === 'ui.input') {
                return { ...bc, message: '[redacted]' };
              }
              return bc;
            });
          }
          return event;
        },
      });
    } catch (error) {
      console.warn('[Sentry] init failed, continuing without monitoring', error);
    }
  });
}

export function captureException(error: unknown, context?: Parameters<SentryModule['captureException']>[1]) {
  void loadSentry().then((Sentry) => {
    if (!Sentry) return;
    Sentry.captureException(error, context);
  });
}
