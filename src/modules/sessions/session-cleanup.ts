import { SessionRepository } from './session.repository';
import { logger } from '@shared/logger';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // every hour

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startSessionCleanup(): void {
  if (intervalId !== null) return;

  intervalId = setInterval(async () => {
    try {
      const repo = new SessionRepository();
      const deleted = await repo.deleteExpired();
      if (deleted > 0) {
        logger.info({ deleted }, 'Session cleanup: expired sessions deleted');
      }
    } catch (error) {
      logger.error({ error }, 'Session cleanup: failed');
    }
  }, CLEANUP_INTERVAL_MS);

  logger.info({ intervalMs: CLEANUP_INTERVAL_MS }, 'Session cleanup cron started');
}

export function stopSessionCleanup(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Session cleanup cron stopped');
  }
}

export async function runSessionCleanupOnce(): Promise<number> {
  const repo = new SessionRepository();
  return repo.deleteExpired();
}
