import * as Sentry from '@sentry/node';
import { getConfig } from '@config';
import { logger } from '@shared/logger';

export function initSentry(): void {
  const config = getConfig();

  if (!config.SENTRY_DSN) {
    logger.warn('Sentry DSN not configured — error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    release: process.env.npm_package_version ?? '1.0.0',
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0,
    sampleRate: 1.0,
    // Don't send transactions for health checks
    ignoreTransactions: ['GET /health/live', 'GET /health/ready', 'GET /metrics'],
    // Attach user context when available
    attachStacktrace: true,
    maxBreadcrumbs: 50,
    beforeSend(event) {
      // Strip sensitive data
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, string>)['authorization'];
        delete (event.request.headers as Record<string, string>)['cookie'];
      }
      return event;
    },
  });

  logger.info({ dsn: config.SENTRY_DSN }, 'Sentry initialized');
}

/**
 * Capture a user context in Sentry for error attribution.
 * Call after authentication to tag errors with userId/email.
 */
export function setSentryUser(userId: string, email?: string): void {
  Sentry.setUser({ id: userId, email });
}

/**
 * Clear user context on logout.
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for structured logging into Sentry traces.
 */
export function addSentryBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({ message, category, data });
}

/**
 * Capture error with optional extra context.
 */
export function captureSentryError(error: Error, extra?: Record<string, unknown>): void {
  Sentry.captureException(error, { extra });
}

export { Sentry };
