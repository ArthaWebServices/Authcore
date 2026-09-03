import { Queue } from 'bullmq';
import { getRedisClient } from '../redis';
import { logger } from '../logger';
import { getConfig } from '../../config';

const config = getConfig();

export const emailQueue = new Queue('email', {
  connection: getRedisClient(),
});

export async function addEmailJob(
  to: string,
  subject: string,
  html: string,
  text?: string,
  options: { delay?: number; attempts?: number } = {}
) {
  try {
    await emailQueue.add(
      'send-email',
      { to, subject, html, text },
      {
        delay: options.delay ?? 0,
        attempts: options.attempts ?? 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );
    logger.info({ to, subject }, 'Email job queued');
  } catch (error) {
    logger.error({ error, to, subject }, 'Failed to queue email job');
    throw error;
  }
}

// Optional: Create a worker to process the queue (can be run in a separate process)
// For now, we just export the queue and the add function.