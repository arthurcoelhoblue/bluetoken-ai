/**
 * Structured logger for Edge Functions with Sentry error reporting.
 * Usage:
 *   import { createLogger } from '../_shared/logger.ts';
 *   const log = createLogger('my-function');
 *   log.info('Processing', { dealId: '123' });
 *   log.error('Failed', { error: e.message });
 *   log.captureException(err); // sends to Sentry
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  level: LogLevel;
  fn: string;
  msg: string;
  ts: string;
  data?: Record<string, unknown>;
}

function emit(entry: LogEntry) {
  const line = JSON.stringify(entry);
  switch (entry.level) {
    case 'ERROR':
      console.error(line);
      break;
    case 'WARN':
      console.warn(line);
      break;
    case 'DEBUG':
      console.debug(line);
      break;
    default:
      console.log(line);
  }
}

/**
 * Sends an error event to Sentry via the HTTP envelope API.
 * Uses SENTRY_DSN env var. Fire-and-forget — never throws.
 */
async function sendToSentry(
  functionName: string,
  error: Error | string,
  extra?: Record<string, unknown>
) {
  try {
    const dsn = Deno.env.get('SENTRY_DSN_EDGE');
    if (!dsn) return;

    const url = new URL(dsn);
    const projectId = url.pathname.replace('/', '');
    const publicKey = url.username;
    const sentryHost = url.origin;

    const eventId = crypto.randomUUID().replace(/-/g, '');
    const timestamp = Date.now() / 1000;

    const errorObj = typeof error === 'string' ? new Error(error) : error;

    const event = {
      event_id: eventId,
      timestamp,
      platform: 'javascript',
      server_name: 'edge-functions',
      environment: Deno.env.get('ENVIRONMENT') || 'production',
      tags: {
        function: functionName,
        runtime: 'deno',
      },
      extra: extra || {},
      exception: {
        values: [
          {
            type: errorObj.name || 'Error',
            value: errorObj.message,
            stacktrace: errorObj.stack
              ? {
                  frames: parseStackFrames(errorObj.stack),
                }
              : undefined,
          },
        ],
      },
    };

    const envelope = [
      JSON.stringify({
        event_id: eventId,
        dsn,
        sent_at: new Date().toISOString(),
      }),
      JSON.stringify({ type: 'event', length: JSON.stringify(event).length }),
      JSON.stringify(event),
    ].join('\n');

    await fetch(`${sentryHost}/api/${projectId}/envelope/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=edge-logger/1.0, sentry_key=${publicKey}`,
      },
      body: envelope,
    });
  } catch {
    // Never let Sentry reporting crash the function
  }
}

function parseStackFrames(stack: string) {
  const lines = stack.split('\n').slice(1);
  return lines
    .map((line) => {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        return {
          function: match[1],
          filename: match[2],
          lineno: parseInt(match[3]),
          colno: parseInt(match[4]),
          in_app: !match[2].includes('node_modules'),
        };
      }
      const match2 = line.match(/at\s+(.+?):(\d+):(\d+)/);
      if (match2) {
        return {
          filename: match2[1],
          lineno: parseInt(match2[2]),
          colno: parseInt(match2[3]),
          in_app: true,
        };
      }
      return null;
    })
    .filter(Boolean)
    .reverse(); // Sentry expects frames in caller-first order
}

export function createLogger(functionName: string) {
  const log = (level: LogLevel, msg: string, data?: Record<string, unknown>) => {
    emit({ level, fn: functionName, msg, ts: new Date().toISOString(), data });
  };

  return {
    info: (msg: string, data?: Record<string, unknown>) => log('INFO', msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log('WARN', msg, data),
    error: (msg: string, data?: Record<string, unknown>) => {
      log('ERROR', msg, data);
      // Auto-report errors to Sentry
      sendToSentry(functionName, msg, data);
    },
    debug: (msg: string, data?: Record<string, unknown>) => log('DEBUG', msg, data),
    /**
     * Capture an exception and send it to Sentry with full stack trace.
     * Use for caught errors: log.captureException(err, { context: 'xyz' });
     */
    captureException: (error: Error | string, extra?: Record<string, unknown>) => {
      const msg = typeof error === 'string' ? error : error.message;
      log('ERROR', msg, { ...extra, stack: typeof error === 'string' ? undefined : error.stack });
      sendToSentry(functionName, error, extra);
    },
  };
}
