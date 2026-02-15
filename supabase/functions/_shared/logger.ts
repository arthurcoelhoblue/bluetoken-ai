/**
 * Structured logger for Edge Functions.
 * Usage:
 *   import { createLogger } from '../_shared/logger.ts';
 *   const log = createLogger('my-function');
 *   log.info('Processing', { dealId: '123' });
 *   log.warn('Slow query', { ms: 1200 });
 *   log.error('Failed', { error: e.message });
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

export function createLogger(functionName: string) {
  const log = (level: LogLevel, msg: string, data?: Record<string, unknown>) => {
    emit({ level, fn: functionName, msg, ts: new Date().toISOString(), data });
  };

  return {
    info: (msg: string, data?: Record<string, unknown>) => log('INFO', msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log('WARN', msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log('ERROR', msg, data),
    debug: (msg: string, data?: Record<string, unknown>) => log('DEBUG', msg, data),
  };
}
