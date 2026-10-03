import { buildApp } from '@app';
import { connectDatabase, disconnectDatabase, healthCheckDatabase } from '@shared/prisma';
import { connectRedis, disconnectRedis, healthCheckRedis } from '@shared/redis';
import { logger } from '@shared/logger';
import { startSessionCleanup, stopSessionCleanup } from '@modules/sessions/session-cleanup';

async function main() {
  const app = await buildApp();

  // Connect to services
  await connectDatabase();
  await connectRedis();

  // Verify health
  const dbHealth = await healthCheckDatabase();
  const redisHealth = await healthCheckRedis();
  logger.info({ dbHealth, redisHealth }, 'Service health checks');

  if (!dbHealth) {
    logger.error('Database health check failed');
    process.exit(1);
  }

  // Start session cleanup cron
  startSessionCleanup();

  // Start server
  const port = Number(process.env.PORT) || 3000;
  try {
    await app.listen({ port, host: '0.0.0.0' });
    logger.info({ port }, 'AuthCore server started');
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  try {
    await disconnectRedis();
    stopSessionCleanup();
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  try {
    await disconnectRedis();
    stopSessionCleanup();
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
});

main().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});