import { WebhookService } from './webhook.service';
import { logger } from '@shared/logger';

const RETRY_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startWebhookRetry(service: WebhookService): void {
  if (intervalId !== null) return;

  intervalId = setInterval(async () => {
    try {
      const result = await service.retryFailed();
      if (result.retried > 0) {
        logger.info(result, 'Webhook retry batch completed');
      }
    } catch (error) {
      logger.error({ error }, 'Webhook retry batch failed');
    }
  }, RETRY_INTERVAL_MS);

  logger.info({ intervalMs: RETRY_INTERVAL_MS }, 'Webhook retry cron started');
}

export function stopWebhookRetry(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Webhook retry cron stopped');
  }
}
